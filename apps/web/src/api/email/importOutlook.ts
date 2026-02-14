/**
 * Outlook Receipt Import
 * Orchestrates fetching emails from Outlook (Microsoft Graph), parsing receipts with AI, and creating purchases
 */

import {
  listMessagesFiltered,
  getMessage,
  parseMessage,
  filterEmailForReceipt,
} from './outlookClient'
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
 * Import purchase receipts from Outlook
 * 1. Fetches recent emails matching receipt patterns via Microsoft Graph
 * 2. Skips emails already processed in previous imports
 * 3. Filters to likely receipts and pre-checks existing order IDs
 * 4. Parses with GPT to extract purchase data
 * 5. Creates purchases via add_purchase RPC (with deduplication)
 */
export async function importOutlookReceipts(
  accessToken: string,
  userId: string,
  options: ImportOptions
): Promise<ImportResult> {
  const { maxMessages = 10, sinceDays = 90, openaiApiKey } = options

  // Validate required credentials
  if (!accessToken) {
    throw new Error('Outlook access token is required')
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

  // Fetch in batches using @odata.nextLink pagination
  const INITIAL_BATCH = 50
  const MAX_EMAILS_SCANNED = 500

  let totalScanned = 0

  // First batch
  const firstResult = await listMessagesFiltered(accessToken, sinceDays, INITIAL_BATCH)
  let messageHeaders = firstResult.messages
  let nextLink = firstResult.nextLink

  if (messageHeaders.length === 0) {
    const log = endImportLog()
    return { imported: [], skipped: 0, errors: [], log }
  }

  const provider = 'outlook' as const
  let processedEmailIds = await getProcessedEmailIds(
    userId,
    provider,
    messageHeaders.map((message) => message.id)
  )

  let headerIndex = 0

  while (results.length < maxMessages && totalScanned < MAX_EMAILS_SCANNED) {
    // If we've exhausted current batch, fetch more via nextLink
    if (headerIndex >= messageHeaders.length) {
      if (!nextLink) break

      const nextResult = await listMessagesFiltered(
        accessToken, sinceDays, INITIAL_BATCH, nextLink
      )
      messageHeaders = nextResult.messages
      nextLink = nextResult.nextLink
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
    p_source: 'email:outlook',
    p_verdict_id: null,
    p_is_past_purchase: true,
    p_past_purchase_outcome: null,
    p_order_id: receipt.order_id,
  })

  if (error) {
    // Detect duplicate via various error indicators
    const errorCode = error.code?.toString() ?? ''
    const errorMsg = error.message?.toLowerCase() ?? ''
    const errorDetails = error.details?.toLowerCase() ?? ''
    const isDuplicate =
      errorCode === '23505' ||
      errorCode === '409' ||
      errorMsg.includes('duplicate') ||
      errorMsg.includes('conflict') ||
      errorDetails.includes('unique') ||
      errorDetails.includes('order_id')

    return { error: isDuplicate ? null : error.message, isDuplicate }
  }

  return { error: null, isDuplicate: false }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
