/**
 * Outlook (Microsoft Graph) API Client
 * Wrapper for Microsoft Graph Mail API to fetch and parse email messages
 */

import {
  stripHtmlAdvanced,
  cleanEmailTextForReceipt,
  filterEmailForReceipt as filterEmailForReceiptService,
  type FilterResult,
} from '../../services/emailProcessing'

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

// Microsoft Graph message types

export type OutlookMessageHeader = {
  id: string
}

export type OutlookListResult = {
  messages: OutlookMessageHeader[]
  nextLink: string | null
}

export type OutlookEmailAddress = {
  emailAddress: {
    name: string
    address: string
  }
}

export type OutlookMessage = {
  id: string
  subject: string
  from: OutlookEmailAddress
  receivedDateTime: string
  body: {
    contentType: 'text' | 'html'
    content: string
  }
}

export type ParsedEmail = {
  id: string
  from: string
  subject: string
  date: string
  textContent: string
}

/**
 * List messages matching a search query using Microsoft Graph
 * Uses $search for keyword matching. Pagination via @odata.nextLink
 * ($skip is not supported with $search).
 */
export async function listMessages(
  accessToken: string,
  searchQuery: string,
  maxResults: number = 100,
  nextLink?: string
): Promise<OutlookListResult> {
  const url = nextLink ?? (() => {
    const params = new URLSearchParams({
      $search: `"${searchQuery}"`,
      $top: maxResults.toString(),
      $select: 'id',
    })
    return `${GRAPH_API_BASE}/me/messages?${params}`
  })()

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      error.error?.message ?? 'Failed to list Outlook messages'
    )
  }

  const data = await response.json()
  const messages = (data.value ?? []).map((msg: { id: string }) => ({ id: msg.id }))
  return { messages, nextLink: data['@odata.nextLink'] ?? null }
}

/**
 * Get full message content by ID
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<OutlookMessage> {
  const params = new URLSearchParams({
    $select: 'id,subject,from,receivedDateTime,body',
  })

  const response = await fetch(
    `${GRAPH_API_BASE}/me/messages/${messageId}?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(
      error.error?.message ?? 'Failed to get Outlook message'
    )
  }

  return response.json()
}

/**
 * Extract text content from an Outlook message body
 */
function extractMessageText(message: OutlookMessage): string {
  const { body } = message

  if (!body.content) {
    return ''
  }

  const rawText =
    body.contentType === 'html'
      ? stripHtmlAdvanced(body.content)
      : body.content

  return cleanEmailTextForReceipt(rawText)
}

/**
 * Parse an Outlook message into a structured format matching Gmail's ParsedEmail
 */
export function parseMessage(message: OutlookMessage): ParsedEmail {
  const from = message.from?.emailAddress
    ? `${message.from.emailAddress.name} <${message.from.emailAddress.address}>`
    : ''

  let date: string
  try {
    date = new Date(message.receivedDateTime).toISOString().split('T')[0]
  } catch {
    date = new Date().toISOString().split('T')[0]
  }

  const textContent = extractMessageText(message)

  return {
    id: message.id,
    from,
    subject: message.subject ?? '',
    date,
    textContent,
  }
}

/**
 * Build search query string for receipt-like emails in Outlook
 * Microsoft Graph $search uses KQL (Keyword Query Language)
 */
export function buildReceiptQuery(): string {
  const keywords = [
    'receipt',
    'order confirmation',
    'invoice',
    'purchase',
    'payment',
    'your order',
  ]

  return keywords.join(' OR ')
}

/**
 * Build $filter for date range (used alongside $search)
 */
export function buildDateFilter(sinceDays: number = 90): string {
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - sinceDays)
  return `receivedDateTime ge ${sinceDate.toISOString()}`
}

/**
 * List messages with search query.
 * Microsoft Graph does not reliably support $search + $filter together,
 * so we use $search only and rely on the receipt query keywords for relevance.
 * Pagination via @odata.nextLink.
 */
export async function listMessagesFiltered(
  accessToken: string,
  _sinceDays: number = 90,
  maxResults: number = 100,
  nextLink?: string
): Promise<OutlookListResult> {
  void _sinceDays
  const searchQuery = buildReceiptQuery()
  return listMessages(accessToken, searchQuery, maxResults, nextLink)
}

export type { FilterResult }

export function filterEmailForReceipt(email: ParsedEmail): FilterResult {
  return filterEmailForReceiptService({
    subject: email.subject,
    textContent: email.textContent,
  })
}
