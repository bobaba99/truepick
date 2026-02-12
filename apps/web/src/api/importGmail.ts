/**
 * Gmail Receipt Import
 * Orchestrates fetching emails from Gmail, parsing receipts with AI, and creating purchases
 */

import {
  listMessages,
  getMessage,
  parseMessage,
  buildReceiptQuery,
  looksLikeReceipt,
} from './gmailClient'
import { parseReceiptWithAI, type ExtractedReceipt } from './receiptParser'
import { updateLastSync } from './emailConnectionService'
import { supabase } from './supabaseClient'

export type ImportOptions = {
  maxMessages?: number
  sinceDays?: number
  openaiApiKey: string
}

export type ImportedPurchase = ExtractedReceipt & {
  emailId: string
  emailSubject: string
}

export type ImportResult = {
  imported: ImportedPurchase[]
  skipped: number
  errors: string[]
}

/**
 * Import purchase receipts from Gmail
 * 1. Fetches recent emails matching receipt patterns
 * 2. Filters to likely receipts
 * 3. Parses with GPT to extract purchase data
 * 4. Creates purchases via add_purchase RPC (with deduplication)
 */
export async function importGmailReceipts(
  accessToken: string,
  userId: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { maxMessages = 10, sinceDays = 90, openaiApiKey } = options

  const results: ImportedPurchase[] = []
  const errors: string[] = []
  let skipped = 0

  // Build Gmail search query
  const query = buildReceiptQuery(sinceDays)

  // List candidate messages (fetch more than needed for filtering)
  const messageHeaders = await listMessages(accessToken, query, maxMessages * 3)

  if (messageHeaders.length === 0) {
    return { imported: [], skipped: 0, errors: [] }
  }

  // Process messages until we have enough receipts
  let processedCount = 0
  for (const header of messageHeaders) {
    if (results.length >= maxMessages) break

    try {
      // Get full message content
      const fullMessage = await getMessage(accessToken, header.id)
      const parsed = parseMessage(fullMessage)

      // Pre-filter: check if email looks like a receipt
      if (!looksLikeReceipt(parsed)) {
        skipped++
        continue
      }

      // Parse with AI - returns array of receipts (one per item)
      const receipts = await parseReceiptWithAI(
        parsed.textContent,
        parsed.from,
        parsed.subject,
        parsed.date,
        openaiApiKey
      )

      if (receipts.length === 0) {
        skipped++
        continue
      }

      // Create purchases for each item in the receipt
      for (const receipt of receipts) {
        // Check if we've reached the max
        if (results.length >= maxMessages) break

        // Create purchase via RPC (handles deduplication via order_id constraint)
        const { error } = await createEmailPurchase(receipt)

        if (error) {
          // Check if it's a duplicate (unique constraint violation)
          if (error.includes('duplicate') || error.includes('unique')) {
            skipped++
          } else {
            errors.push(`${receipt.title}: ${error}`)
          }
          continue
        }

        results.push({
          ...receipt,
          emailId: header.id,
          emailSubject: parsed.subject,
        })
      }

      processedCount++

      // Rate limiting: brief pause between API calls
      if (processedCount < messageHeaders.length) {
        await sleep(100)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`Message ${header.id}: ${message}`)
    }
  }

  // Update last sync timestamp
  await updateLastSync(userId)

  return { imported: results, skipped, errors }
}

/**
 * Create a purchase from an extracted email receipt
 */
async function createEmailPurchase(
  receipt: ExtractedReceipt
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('add_purchase', {
    p_title: receipt.title,
    p_price: receipt.price,
    p_vendor: receipt.vendor,
    p_category: receipt.category,
    p_purchase_date: receipt.purchase_date,
    p_source: 'email',
    p_verdict_id: null,
    p_is_past_purchase: true,
    p_past_purchase_outcome: null,
    p_order_id: receipt.order_id,
  })

  return { error: error?.message ?? null }
}

/**
 * Check for existing purchases to avoid re-importing
 * Returns order_ids that already exist
 */
export async function getExistingOrderIds(
  userId: string,
  orderIds: string[]
): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set()

  const { data, error } = await supabase
    .from('purchases')
    .select('order_id')
    .eq('user_id', userId)
    .in('order_id', orderIds)

  if (error) {
    throw new Error(error.message)
  }

  return new Set(
    (data ?? []).map((row) => row.order_id).filter((id): id is string => !!id)
  )
}

/**
 * Get import history for display
 */
export async function getEmailImportStats(userId: string): Promise<{
  totalImported: number
  lastSyncDate: string | null
}> {
  // Count purchases from email source
  const { count, error: countError } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'email')

  if (countError) {
    throw new Error(countError.message)
  }

  // Get last sync date from email_connections
  const { data: connection, error: connError } = await supabase
    .from('email_connections')
    .select('last_sync')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (connError && connError.code !== 'PGRST116') {
    throw new Error(connError.message)
  }

  return {
    totalImported: count ?? 0,
    lastSyncDate: connection?.last_sync ?? null,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
