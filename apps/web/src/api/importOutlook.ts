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
import { supabase } from './supabaseClient'
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
 * 2. Filters to likely receipts
 * 3. Parses with GPT to extract purchase data
 * 4. Creates purchases via add_purchase RPC (with deduplication)
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

  // List candidate messages (fetch more than needed for filtering)
  const messageHeaders = await listMessagesFiltered(
    accessToken,
    sinceDays,
    maxMessages * 5
  )

  if (messageHeaders.length === 0) {
    const log = endImportLog()
    return { imported: [], skipped: 0, errors: [], log }
  }

  // Process messages until we have enough receipts
  let processedCount = 0
  for (const header of messageHeaders) {
    if (results.length >= maxMessages) break

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
        continue
      }

      // Create purchases for each item in the receipt
      for (const receipt of receipts) {
        // Check if we've reached the max
        if (results.length >= maxMessages) break

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

      processedCount++

      // Rate limiting: brief pause between API calls
      if (processedCount < messageHeaders.length) {
        await sleep(100)
      }
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
    p_source: 'email',
    p_verdict_id: null,
    p_is_past_purchase: true,
    p_past_purchase_outcome: null,
    p_order_id: receipt.order_id,
  })

  if (error) {
    // Detect duplicate via various error indicators
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
