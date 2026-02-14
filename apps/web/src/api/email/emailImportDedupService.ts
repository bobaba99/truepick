import { supabase } from '../core/supabaseClient'

export type EmailImportProvider = 'gmail' | 'outlook'

type OrderIdRow = {
  order_id: string | null
}

type ProcessedEmailRow = {
  email_id: string | null
}

type ExistingPurchaseRow = {
  id: string
  title: string
  price: number | string
  purchase_date: string
  order_id: string | null
}

const ORDER_ID_PATTERNS = [
  /\b(?:order|confirmation|invoice|transaction)\s*(?:id|number|no|#)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]{4,99})\b/gi,
  /\b(?:receipt|reference)\s*(?:id|number|no|#)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]{4,99})\b/gi,
]

function isMissingProcessedTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    error.message?.toLowerCase().includes('email_processed_messages') === true
  )
}

function normalizeEmailId(emailId: string): string | null {
  const trimmed = emailId.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeOrderId(orderId: string): string | null {
  const cleaned = orderId
    .trim()
    .replace(/^[#\s]+/u, '')
    .replace(/[),.;:\s]+$/u, '')
    .replace(/\s+/gu, ' ')

  if (cleaned.length < 5 || cleaned.length > 100) {
    return null
  }

  if (!/[0-9]/u.test(cleaned)) {
    return null
  }

  return cleaned
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
}

/**
 * Extract deterministic order ID candidates from email text before AI parsing.
 * This is intentionally conservative to avoid false positives.
 */
export function extractCandidateOrderIds(
  subject: string,
  textContent: string
): string[] {
  const searchText = `${subject}\n${textContent}`
  const uniqueOrderIds = new Set<string>()

  for (const pattern of ORDER_ID_PATTERNS) {
    for (const match of searchText.matchAll(pattern)) {
      const candidate = match[1]
      if (!candidate) {
        continue
      }

      const normalized = normalizeOrderId(candidate)
      if (normalized) {
        uniqueOrderIds.add(normalized)
      }
    }
  }

  return Array.from(uniqueOrderIds)
}

export async function getExistingOrderIds(
  userId: string,
  orderIds: string[]
): Promise<Set<string>> {
  const normalizedOrderIds = Array.from(
    new Set(
      orderIds
        .map((orderId) => normalizeOrderId(orderId))
        .filter((orderId): orderId is string => !!orderId)
    )
  )

  if (normalizedOrderIds.length === 0) {
    return new Set()
  }

  const { data, error } = await supabase
    .from('purchases')
    .select('order_id')
    .eq('user_id', userId)
    .in('order_id', normalizedOrderIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Set(
    ((data ?? []) as OrderIdRow[])
      .map((row) => row.order_id)
      .map((orderId) => (orderId ? normalizeOrderId(orderId) : null))
      .filter((orderId): orderId is string => !!orderId)
  )
}

export async function getProcessedEmailIds(
  userId: string,
  provider: EmailImportProvider,
  emailIds: string[]
): Promise<Set<string>> {
  const normalizedEmailIds = Array.from(
    new Set(
      emailIds
        .map((emailId) => normalizeEmailId(emailId))
        .filter((emailId): emailId is string => !!emailId)
    )
  )

  if (normalizedEmailIds.length === 0) {
    return new Set()
  }

  const { data, error } = await supabase
    .from('email_processed_messages')
    .select('email_id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .in('email_id', normalizedEmailIds)

  if (error) {
    if (isMissingProcessedTableError(error)) {
      return new Set()
    }
    throw new Error(error.message)
  }

  return new Set(
    ((data ?? []) as ProcessedEmailRow[])
      .map((row) => row.email_id)
      .filter((emailId): emailId is string => !!emailId)
  )
}

export async function markEmailAsProcessed(
  userId: string,
  provider: EmailImportProvider,
  emailId: string
): Promise<void> {
  const normalizedEmailId = normalizeEmailId(emailId)
  if (!normalizedEmailId) {
    return
  }

  const { error } = await supabase
    .from('email_processed_messages')
    .upsert(
      {
        user_id: userId,
        provider,
        email_id: normalizedEmailId,
        last_processed_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,provider,email_id',
      }
    )

  if (error) {
    if (isMissingProcessedTableError(error)) {
      return
    }
    throw new Error(error.message)
  }
}

/**
 * Cross-message dedupe for cases where the same purchase is represented by
 * multiple provider updates (e.g. merchant confirmation + payment authorization).
 */
export async function hasExistingPurchaseFingerprint(
  userId: string,
  receipt: {
    title: string
    price: number
    purchase_date: string
    order_id: string | null
  }
): Promise<boolean> {
  const normalizedTitle = normalizeTitle(receipt.title)
  if (!normalizedTitle) {
    return false
  }

  const purchaseDate = new Date(receipt.purchase_date)
  if (Number.isNaN(purchaseDate.getTime())) {
    return false
  }

  const fromDate = new Date(purchaseDate)
  fromDate.setDate(fromDate.getDate() - 1)
  const toDate = new Date(purchaseDate)
  toDate.setDate(toDate.getDate() + 1)
  const normalizedIncomingOrderId = receipt.order_id ? normalizeOrderId(receipt.order_id) : null

  const { data, error } = await supabase
    .from('purchases')
    .select('id, title, price, purchase_date, order_id')
    .eq('user_id', userId)
    .like('source', 'email%')
    .gte('purchase_date', fromDate.toISOString().slice(0, 10))
    .lte('purchase_date', toDate.toISOString().slice(0, 10))

  if (error) {
    throw new Error(error.message)
  }

  for (const row of (data ?? []) as ExistingPurchaseRow[]) {
    const normalizedExistingTitle = normalizeTitle(row.title)
    if (normalizedExistingTitle !== normalizedTitle) {
      continue
    }

    const existingPrice = typeof row.price === 'number' ? row.price : Number(row.price)
    if (!Number.isFinite(existingPrice) || Math.abs(existingPrice - receipt.price) > 0.01) {
      continue
    }

    const normalizedExistingOrderId = row.order_id ? normalizeOrderId(row.order_id) : null
    if (
      normalizedIncomingOrderId &&
      normalizedExistingOrderId &&
      normalizedIncomingOrderId !== normalizedExistingOrderId
    ) {
      continue
    }

    return true
  }

  return false
}
