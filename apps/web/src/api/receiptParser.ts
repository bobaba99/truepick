/**
 * Receipt Parser
 * Uses GPT-5-nano to extract structured purchase data from email content
 */

import type { PurchaseCategory } from './types'

export type ExtractedReceipt = {
  title: string
  price: number
  vendor: string
  category: PurchaseCategory | null
  purchase_date: string
  order_id: string | null
}

type OpenAIResponse = {
  choices: Array<{
    message: {
      content: string
    }
    finish_reason: string
  }>
}

const EXTRACTION_PROMPT = `You are a receipt parser that extracts purchase information from email content.

Extract the following fields for EACH item purchased:
- title: The item/product name (be specific but concise)
- price: The item price as a number (no currency symbols). Must be the actual price paid, not 0.
- vendor: The store/merchant name
- category: One of: electronics, fashion, home goods, health & wellness, travel, experiences, subscriptions, food & beverage, services, education, other
- purchase_date: The date of purchase in YYYY-MM-DD format
- order_id: The order/confirmation number if present, otherwise null

Rules:
- If multiple items are purchased, return EACH item as a separate object in a JSON array
- For subscriptions, include the period in the title (e.g., "Netflix 1 Month")
- SKIP any item where the price cannot be determined - do not include items with price 0 or unknown price
- If date cannot be determined, use the email date
- Return valid JSON only, no markdown

Email sender: {sender}
Email subject: {subject}
Email date: {email_date}

Email content:
{content}

If this is NOT a purchase receipt (e.g., promotional email, newsletter, shipping update without purchase details), respond with exactly: {"not_a_receipt": true}

For a SINGLE item, respond with:
{"items": [{"title": "...", "price": 12.99, "vendor": "...", "category": "...", "purchase_date": "YYYY-MM-DD", "order_id": "..." or null}]}

For MULTIPLE items, respond with:
{"items": [{"title": "Item 1", "price": 12.99, "vendor": "...", "category": "...", "purchase_date": "YYYY-MM-DD", "order_id": "..."}, {"title": "Item 2", "price": 8.50, "vendor": "...", "category": "...", "purchase_date": "YYYY-MM-DD", "order_id": "..."}]}`

const VALID_CATEGORIES: PurchaseCategory[] = [
  'electronics',
  'fashion',
  'home goods',
  'health & wellness',
  'travel',
  'experiences',
  'subscriptions',
  'food & beverage',
  'services',
  'education',
  'other',
]

/**
 * Parse receipt email content using GPT-4o-mini
 * Returns an array of extracted receipts (one per item in the email)
 */
export async function parseReceiptWithAI(
  emailText: string,
  sender: string,
  subject: string,
  emailDate: string,
  openaiApiKey: string
): Promise<ExtractedReceipt[]> {
  // Truncate content to avoid token limits (keep first 4000 chars)
  const truncatedContent =
    emailText.length > 4000 ? emailText.slice(0, 4000) + '...' : emailText

  const prompt = EXTRACTION_PROMPT.replace('{sender}', sender)
    .replace('{subject}', subject)
    .replace('{email_date}', emailDate)
    .replace('{content}', truncatedContent)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message ?? 'OpenAI API request failed')
    }

    const data: OpenAIResponse = await response.json()
    const content = data.choices[0]?.message?.content?.trim()

    if (!content) {
      return []
    }

    // Parse JSON response
    const parsed = JSON.parse(content)

    // Check if it's not a receipt
    if (parsed.not_a_receipt) {
      return []
    }

    // Handle both array format and legacy single object format
    const items = Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed)
        ? parsed
        : [parsed]

    // Validate and normalize each item, filtering out invalid ones
    const results: ExtractedReceipt[] = []
    for (const item of items) {
      const validated = validateAndNormalize(item, emailDate)
      if (validated) {
        results.push(validated)
      }
    }

    return results
  } catch (error) {
    if (error instanceof SyntaxError) {
      // JSON parse error - not a valid receipt response
      return []
    }
    throw error
  }
}

/**
 * Validate and normalize extracted receipt data
 * Returns null if required fields are missing or price is invalid
 */
function validateAndNormalize(
  data: Record<string, unknown>,
  fallbackDate: string
): ExtractedReceipt | null {
  // Title is required
  if (typeof data.title !== 'string' || !data.title.trim()) {
    return null
  }

  // Parse and validate price - must be a positive number
  let price = 0
  if (typeof data.price === 'number') {
    price = data.price
  } else if (typeof data.price === 'string') {
    price = parseFloat(data.price.replace(/[^0-9.]/g, '')) || 0
  }

  // Skip items without valid price (price must be > 0)
  if (price <= 0) {
    return null
  }

  // Vendor is required
  if (typeof data.vendor !== 'string' || !data.vendor.trim()) {
    return null
  }

  // Validate category
  let category: PurchaseCategory | null = null
  if (
    typeof data.category === 'string' &&
    VALID_CATEGORIES.includes(data.category as PurchaseCategory)
  ) {
    category = data.category as PurchaseCategory
  }

  // Validate and normalize date
  let purchaseDate = fallbackDate
  if (typeof data.purchase_date === 'string') {
    const dateMatch = data.purchase_date.match(/^\d{4}-\d{2}-\d{2}$/)
    if (dateMatch) {
      purchaseDate = data.purchase_date
    }
  }

  // Order ID is optional
  const orderId =
    typeof data.order_id === 'string' && data.order_id.trim()
      ? data.order_id.trim()
      : null

  return {
    title: data.title.trim().slice(0, 200),
    price: Math.round(price * 100) / 100,
    vendor: data.vendor.trim().slice(0, 100),
    category,
    purchase_date: purchaseDate,
    order_id: orderId?.slice(0, 100) ?? null,
  }
}

/**
 * Batch parse multiple emails with rate limiting
 * Returns a flat array of all extracted receipts from all emails
 */
export async function parseReceiptsBatch(
  emails: Array<{
    text: string
    sender: string
    subject: string
    date: string
  }>,
  openaiApiKey: string,
  delayMs: number = 200
): Promise<ExtractedReceipt[]> {
  const results: ExtractedReceipt[] = []

  for (const email of emails) {
    try {
      const receipts = await parseReceiptWithAI(
        email.text,
        email.sender,
        email.subject,
        email.date,
        openaiApiKey
      )
      results.push(...receipts)
    } catch (error) {
      console.error('Failed to parse email:', email.subject, error)
    }

    // Rate limiting delay between API calls
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return results
}
