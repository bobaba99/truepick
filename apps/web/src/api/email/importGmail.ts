/**
 * Gmail Receipt Import
 * Orchestrates fetching emails from Gmail, parsing receipts with AI, and creating purchases
 */

import {
  listMessages,
  getMessage,
  parseMessage,
  buildReceiptQuery,
  filterEmailForReceipt,
} from './gmailClient'
import { parseReceiptWithAI, type ExtractedReceipt } from './receiptParser'
import { updateLastSync } from './emailConnectionService'
import { supabase } from '../core/supabaseClient'
import {
  extractCandidateOrderIds,
  hasExistingPurchaseFingerprint,
  getExistingOrderIds,
  getProcessedEmailIds,
  markEmailAsProcessed,
} from './emailImportDedupService'
import {
  startImportLog,
  logImport,
  logSkip,
  logError,
  logFilterReject,
  endImportLog,
  logFetchedMessage,
  clearFetchedMessages,
  downloadMessagesMarkdown,
  previewMessagesMarkdown,
  type ImportLogSummary,
} from './log/importLogger'

// Re-export markdown functions for UI access
export { downloadMessagesMarkdown, previewMessagesMarkdown }

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
  log?: ImportLogSummary
}

/**
 * Import purchase receipts from Gmail
 * 1. Fetches recent emails matching receipt patterns
 * 2. Skips emails already processed in previous imports
 * 3. Filters to likely receipts and pre-checks existing order IDs
 * 4. Parses with GPT to extract purchase data
 * 5. Creates purchases via add_purchase RPC (with deduplication)
 */
export async function importGmailReceipts(
  accessToken: string,
  userId: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { maxMessages = 10, sinceDays = 90, openaiApiKey } = options

  // Validate required credentials
  if (!accessToken) {
    throw new Error('Gmail access token is required')
  }
  if (!openaiApiKey) {
    throw new Error('OpenAI API key is required. Set VITE_OPENAI_API_KEY in .env')
  }

  // Start logging session
  startImportLog()
  clearFetchedMessages()

  const results: ImportedPurchase[] = []
  const errors: string[] = []
  let skipped = 0

  // Build Gmail search query
  const query = buildReceiptQuery(sinceDays)

  // Fetch in batches: start with INITIAL_BATCH, then REFILL_BATCH until maxMessages hits
  const INITIAL_BATCH = 50
  const REFILL_BATCH = 25
  const MAX_EMAILS_SCANNED = 500

  let pageToken: string | undefined
  let hasMoreMessages = true
  let totalScanned = 0

  // First batch
  const firstResult = await listMessages(accessToken, query, INITIAL_BATCH)
  let messageHeaders = firstResult.messages
  pageToken = firstResult.nextPageToken ?? undefined
  hasMoreMessages = !!pageToken

  if (messageHeaders.length === 0) {
    const log = endImportLog()
    return { imported: [], skipped: 0, errors: [], log }
  }

  const provider = 'gmail' as const
  let processedEmailIds = await getProcessedEmailIds(
    userId,
    provider,
    messageHeaders.map((message) => message.id)
  )

  let headerIndex = 0

  while (results.length < maxMessages && totalScanned < MAX_EMAILS_SCANNED) {
    // If we've exhausted current batch, fetch more
    if (headerIndex >= messageHeaders.length) {
      if (!hasMoreMessages) break

      const nextResult = await listMessages(accessToken, query, REFILL_BATCH, pageToken)
      messageHeaders = nextResult.messages
      pageToken = nextResult.nextPageToken ?? undefined
      hasMoreMessages = !!pageToken
      headerIndex = 0

      if (messageHeaders.length === 0) break

      processedEmailIds = await getProcessedEmailIds(
        userId,
        provider,
        messageHeaders.map((message) => message.id)
      )
    }

    const header = messageHeaders[headerIndex]
    totalScanned++
    headerIndex++

    if (processedEmailIds.has(header.id)) {
      skipped++
      logSkip({
        emailId: header.id,
        reason: 'already_processed_email_id',
      })
      continue
    }

    try {
      // Get full message content
      const fullMessage = await getMessage(accessToken, header.id)
      const parsed = parseMessage(fullMessage)

      // Multi-stage pre-filter: check if email looks like a receipt
      const filterResult = filterEmailForReceipt(parsed)

      if (!filterResult.shouldProcess) {
        // Log rejected message for markdown export
        logFetchedMessage({
          emailId: header.id,
          from: parsed.from,
          subject: parsed.subject,
          date: parsed.date,
          textContent: parsed.textContent,
          filterResult,
        })
        skipped++
        logFilterReject({
          emailId: header.id,
          emailSubject: parsed.subject,
          reason: filterResult.rejectionReason ?? 'unknown',
          confidence: filterResult.confidence,
        })
        await markProcessedEmailSafely({
          userId,
          provider,
          emailId: header.id,
          emailSubject: parsed.subject,
          errors,
        })
        continue
      }

      const candidateOrderIds = extractCandidateOrderIds(parsed.subject, parsed.textContent)
      if (candidateOrderIds.length > 0) {
        const existingOrderIds = await getExistingOrderIds(userId, candidateOrderIds)

        if (existingOrderIds.size > 0) {
          logFetchedMessage({
            emailId: header.id,
            from: parsed.from,
            subject: parsed.subject,
            date: parsed.date,
            textContent: parsed.textContent,
            filterResult,
          })
          skipped++
          logSkip({
            emailId: header.id,
            emailSubject: parsed.subject,
            reason: 'existing_order_id_pre_ai',
          })
          await markProcessedEmailSafely({
            userId,
            provider,
            emailId: header.id,
            emailSubject: parsed.subject,
            errors,
          })
          continue
        }
      }

      // Parse with AI - returns array of receipts (one per item)
      const receipts = await parseReceiptWithAI(
        parsed.textContent,
        parsed.from,
        parsed.subject,
        parsed.date,
        openaiApiKey
      )

      // Log fetched message with extracted receipts for markdown export
      logFetchedMessage({
        emailId: header.id,
        from: parsed.from,
        subject: parsed.subject,
        date: parsed.date,
        textContent: parsed.textContent,
        filterResult,
        extractedReceipts: receipts.map((r) => ({
          title: r.title,
          price: r.price,
          vendor: r.vendor,
          category: r.category,
        })),
      })

      if (receipts.length === 0) {
        skipped++
        logSkip({
          emailId: header.id,
          emailSubject: parsed.subject,
          reason: 'llm_returned_empty',
        })
        await markProcessedEmailSafely({
          userId,
          provider,
          emailId: header.id,
          emailSubject: parsed.subject,
          errors,
        })
        continue
      }

      let hitMessageImportLimit = false

      // Create purchases for each item in the receipt
      for (const receipt of receipts) {
        // Check if we've reached the max
        if (results.length >= maxMessages) {
          hitMessageImportLimit = true
          break
        }

        const fingerprintDuplicate = await hasExistingPurchaseFingerprint(userId, receipt)
        if (fingerprintDuplicate) {
          skipped++
          logSkip({
            emailId: header.id,
            emailSubject: parsed.subject,
            reason: 'duplicate_purchase_fingerprint',
          })
          continue
        }

        // Create purchase via RPC (handles deduplication via order_id constraint)
        const { error, isDuplicate } = await createEmailPurchase(receipt)

        if (isDuplicate) {
          skipped++
          logSkip({
            emailId: header.id,
            emailSubject: parsed.subject,
            reason: 'duplicate_order_id',
          })
          continue
        }

        if (error) {
          errors.push(`${receipt.title}: ${error}`)
          logError({
            emailId: header.id,
            emailSubject: parsed.subject,
            reason: error,
          })
          continue
        }

        // Log successful import
        logImport({
          emailId: header.id,
          emailSubject: parsed.subject,
          title: receipt.title,
          price: receipt.price,
          vendor: receipt.vendor,
        })

        results.push({
          ...receipt,
          emailId: header.id,
          emailSubject: parsed.subject,
        })
      }

      if (!hitMessageImportLimit) {
        await markProcessedEmailSafely({
          userId,
          provider,
          emailId: header.id,
          emailSubject: parsed.subject,
          errors,
        })
      }

      // Rate limiting: brief pause between API calls
      await sleep(100)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`Message ${header.id}: ${message}`)
      logError({
        emailId: header.id,
        reason: message,
      })
    }
  }

  // Update last sync timestamp
  await updateLastSync(userId)

  // End logging session and get summary
  const log = endImportLog()

  return { imported: results, skipped, errors, log }
}

async function markProcessedEmailSafely(args: {
  userId: string
  provider: 'gmail' | 'outlook'
  emailId: string
  emailSubject?: string
  errors: string[]
}): Promise<void> {
  try {
    await markEmailAsProcessed(args.userId, args.provider, args.emailId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    args.errors.push(`Failed to mark email ${args.emailId} as processed: ${message}`)
    logError({
      emailId: args.emailId,
      emailSubject: args.emailSubject,
      reason: `mark_processed_failed: ${message}`,
    })
  }
}

/**
 * Create a purchase from an extracted email receipt
 */
async function createEmailPurchase(
  receipt: ExtractedReceipt
): Promise<{ error: string | null; isDuplicate: boolean }> {
  const { error } = await supabase.rpc('add_purchase', {
    p_title: receipt.title,
    p_price: receipt.price,
    p_vendor: receipt.vendor,
    p_category: receipt.category,
    p_purchase_date: receipt.purchase_date,
    p_source: 'email:gmail',
    p_verdict_id: null,
    p_is_past_purchase: true,
    p_past_purchase_outcome: null,
    p_order_id: receipt.order_id,
  })

  if (error) {
    // Detect duplicate via various error indicators
    // - 23505: PostgreSQL unique constraint violation
    // - 409: HTTP Conflict status (Supabase)
    // - error message/details containing duplicate/unique keywords
    const isDuplicate =
      error.code === '23505' ||
      error.code === '409' ||
      error.message.toLowerCase().includes('duplicate') ||
      error.message.toLowerCase().includes('conflict') ||
      error.details?.toLowerCase().includes('unique') ||
      error.details?.toLowerCase().includes('order_id') ||
      false

    return { error: error.message, isDuplicate }
  }

  return { error: null, isDuplicate: false }
}

export { getExistingOrderIds } from './emailImportDedupService'

/**
 * Get import history for display
 */
export async function getEmailImportStats(userId: string): Promise<{
  totalImported: number
  lastSyncDate: string | null
}> {
  // Count purchases from email source (matches 'email:gmail', 'email:outlook', and legacy 'email')
  const { count, error: countError } = await supabase
    .from('purchases')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .like('source', 'email%')

  if (countError) {
    throw new Error(countError.message)
  }

  // Get last sync date from email_connections
  const { data: connection, error: connError } = await supabase
    .from('email_connections')
    .select('last_sync')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (connError) {
    throw new Error(connError.message)
  }

  return {
    totalImported: count ?? 0,
    lastSyncDate: connection?.last_sync ?? null,
  }
}

export type EmailImportedPurchase = {
  id: string
  title: string
  price: number
  vendor: string | null
  category: string | null
  purchase_date: string
  source: string
  created_at: string
}

/**
 * Get all email-imported purchases for display
 */
export async function getEmailImportedPurchases(
  userId: string
): Promise<EmailImportedPurchase[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, title, price, vendor, category, purchase_date, source, created_at')
    .eq('user_id', userId)
    .like('source', 'email%')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as EmailImportedPurchase[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
