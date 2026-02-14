/**
 * Gmail API Client
 * Wrapper for Gmail REST API to fetch and parse email messages
 */

import {
  stripHtmlAdvanced,
  cleanEmailTextForReceipt,
  matchesNegativePatterns as matchesNegativePatternsService,
  detectPricePatterns as detectPricePatternsService,
  calculateReceiptConfidence as calculateReceiptConfidenceService,
  filterEmailForReceipt as filterEmailForReceiptService,
  type FilterResult,
} from '../services/emailProcessing'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'

export type GmailMessageHeader = {
  id: string
  threadId: string
}

export type GmailMessagePart = {
  mimeType: string
  body: {
    data?: string
    size: number
  }
  parts?: GmailMessagePart[]
}

export type GmailMessage = {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    mimeType: string
    body: {
      data?: string
      size: number
    }
    parts?: GmailMessagePart[]
  }
  internalDate: string
}

export type ParsedEmail = {
  id: string
  from: string
  subject: string
  date: string
  textContent: string
}

/**
 * List messages matching a search query
 */
export type ListMessagesResult = {
  messages: GmailMessageHeader[]
  nextPageToken: string | null
}

export async function listMessages(
  accessToken: string,
  query: string,
  maxResults: number = 100,
  pageToken?: string
): Promise<ListMessagesResult> {
  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
  })
  if (pageToken) {
    params.set('pageToken', pageToken)
  }

  const response = await fetch(
    `${GMAIL_API_BASE}/users/me/messages?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message ?? 'Failed to list Gmail messages')
  }

  const data = await response.json()
  return {
    messages: data.messages ?? [],
    nextPageToken: data.nextPageToken ?? null,
  }
}

/**
 * Get full message content by ID
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const response = await fetch(
    `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=full`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message ?? 'Failed to get Gmail message')
  }

  return response.json()
}

/**
 * Decode base64url encoded string
 */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch {
    return atob(base64)
  }
}

/**
 * Strip HTML tags and clean up text content
 * Uses advanced HTML stripping from emailParser for better results
 */
function stripHtml(html: string): string {
  return stripHtmlAdvanced(html)
}

/**
 * Extract text content from message parts recursively
 */
function extractTextFromParts(parts: GmailMessagePart[]): string {
  let textContent = ''
  let htmlContent = ''

  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body.data) {
      textContent += decodeBase64Url(part.body.data) + '\n'
    } else if (part.mimeType === 'text/html' && part.body.data) {
      htmlContent += decodeBase64Url(part.body.data) + '\n'
    } else if (part.parts) {
      const nested = extractTextFromParts(part.parts)
      if (nested) {
        textContent += nested
      }
    }
  }

  // Prefer plain text, fall back to stripped HTML
  return textContent || stripHtml(htmlContent)
}

/**
 * Extract text content from a Gmail message
 */
export function extractMessageText(message: GmailMessage): string {
  const { payload } = message

  // Simple message with body data
  if (payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data)
    const text = payload.mimeType === 'text/html' ? stripHtml(decoded) : decoded
    return cleanEmailTextForReceipt(text)
  }

  // Multipart message
  if (payload.parts) {
    const rawText = extractTextFromParts(payload.parts)
    return cleanEmailTextForReceipt(rawText)
  }

  // Fallback to snippet
  return message.snippet
}

/**
 * Extract header value by name
 */
function getHeader(message: GmailMessage, name: string): string {
  const header = message.payload.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )
  return header?.value ?? ''
}

/**
 * Parse a Gmail message into a structured format
 */
export function parseMessage(message: GmailMessage): ParsedEmail {
  const from = getHeader(message, 'From')
  const subject = getHeader(message, 'Subject')
  const dateHeader = getHeader(message, 'Date')

  // Parse date to ISO format
  let date: string
  try {
    date = new Date(dateHeader).toISOString().split('T')[0]
  } catch {
    date = new Date(parseInt(message.internalDate)).toISOString().split('T')[0]
  }

  const textContent = extractMessageText(message)

  return {
    id: message.id,
    from,
    subject,
    date,
    textContent,
  }
}

/**
 * Build Gmail search query for receipt-like emails
 */
export function buildReceiptQuery(sinceDays: number = 90): string {
  const filters = [
    // Sender patterns
    'from:(noreply OR no-reply OR receipt OR order OR confirmation OR shipping OR auto-confirm)',
    // Subject patterns
    'subject:(receipt OR order OR confirmation OR "thank you for your" OR shipping OR invoice OR "your purchase")',
    // Time filter
    `newer_than:${sinceDays}d`,
  ]
  return filters.join(' ')
}

/**
 * Check if an email looks like a purchase receipt based on content
 * @deprecated Use filterEmailForReceipt() for multi-stage filtering
 */
export function looksLikeReceipt(email: ParsedEmail): boolean {
  const lowerContent = (email.subject + ' ' + email.textContent).toLowerCase()

  // TODO: update keywords
  const receiptKeywords = [
    'order confirmation',
    'order #',
    'order number',
    'receipt',
    'invoice',
    'thank you for your purchase',
    'thank you for your order',
    'your order has been',
    'payment received',
    'transaction',
    'subtotal',
    'total:',
    'amount paid',
    'billing',
  ]

  const matchCount = receiptKeywords.filter((keyword) =>
    lowerContent.includes(keyword)
  ).length

  return matchCount >= 2
}

// =============================================================================
// Multi-Stage Receipt Filtering Pipeline (delegated to emailProcessing service)
// =============================================================================

export type { FilterResult }

export function matchesNegativePatterns(email: ParsedEmail): boolean {
  return matchesNegativePatternsService({
    subject: email.subject,
    textContent: email.textContent,
  })
}

export function detectPricePatterns(email: ParsedEmail): number {
  return detectPricePatternsService({
    subject: email.subject,
    textContent: email.textContent,
  })
}

export function calculateReceiptConfidence(email: ParsedEmail): number {
  return calculateReceiptConfidenceService({
    subject: email.subject,
    textContent: email.textContent,
  })
}

export function filterEmailForReceipt(email: ParsedEmail): FilterResult {
  return filterEmailForReceiptService({
    subject: email.subject,
    textContent: email.textContent,
  })
}
