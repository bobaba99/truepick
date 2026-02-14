/**
 * Receipt Filter (Hard Filter Only)
 * Shared Stage 1-3 filtering logic for receipt detection.
 */

import type { FilterResult, ReceiptFilterEmail } from './types'

const PRICE_WEIGHT = 0.4
const KEYWORD_WEIGHT = 0.6
const CONFIDENCE_THRESHOLD = 0.5

/**
 * Stage 1: Reject emails matching non-receipt patterns.
 * Returns true when email should be rejected.
 */
export function matchesNegativePatterns(email: ReceiptFilterEmail): boolean {
  const content = (email.subject + ' ' + email.textContent).toLowerCase()

  const negativePatterns = [
    /refund\s+(initiated|processed|issued)/,
    /return\s+(label|authorized|received|request)/,
    /\breturn\b.*\brequest\b/,
    /(order|subscription)\s+(was|has\s+been)\s+cancell?ed/,
    /your\s+(package|order)\s+(has\s+)?(shipped|is\s+on\s+the\s+way)/,
    /tracking\s+(update|notification)/,
    /out\s+for\s+delivery/,
    /shipment\s+(update|notification)/,
    /password\s+(reset|changed|updated)/,
    /account\s+(updated|settings|verification)/,
    /subscription\s+(cancelled|ended|expired)/,
    /payment\s+method\s+(updated|failed|expired)/,
    /verify\s+your\s+(email|account)/,
  ]

  return negativePatterns.some((pattern) => pattern.test(content))
}

/**
 * Some providers (notably Uber Eats) include delivery/status wording inside valid receipts.
 * This checks for strong receipt evidence so we don't reject those messages too early.
 */
function hasStrongReceiptEvidence(email: ReceiptFilterEmail): boolean {
  const content = (email.subject + ' ' + email.textContent).toLowerCase()
  const strongSignals = [
    `here's your receipt`,
    'thank you for your purchase',
    'thanks for ordering',
    'your order with uber eats',
    'you ordered from',
    'order #',
  ]

  return strongSignals.some((signal) => content.includes(signal))
}

/**
 * Stage 2: Check for price patterns in email.
 * Returns confidence score in [0, 1].
 */
export function detectPricePatterns(email: ReceiptFilterEmail): number {
  const content = email.subject + ' ' + email.textContent

  const pricePatterns = [
    /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/,
    /(USD|CAD)\s*\$?\s*\d+(?:[.,]\d{2})?/i,
    /(order|grand)?\s*total\s*[:\s]+\$?\s*\d+(?:[.,]\d{2})?/i,
    /amount\s*(paid|charged)?\s*[:\s]+\$?\s*\d+(?:[.,]\d{2})?/i,
    /subtotal\s*[:\s]+\$?\s*\d+(?:[.,]\d{2})?/i,
    /(tax|gst|hst|pst)\s*[:\s]+\$?\s*\d+(?:[.,]\d{2})?/i,
  ]

  const matchCount = pricePatterns.filter((p) => p.test(content)).length

  if (matchCount === 0) return 0
  if (matchCount >= 2) return 1
  return 0.5
}

/**
 * Stage 3: Weighted keyword confidence in [0, 1].
 */
export function calculateReceiptConfidence(email: ReceiptFilterEmail): number {
  const content = (email.subject + ' ' + email.textContent).toLowerCase()

  const highWeight = [
    'order confirmation',
    'payment received',
    'receipt for your',
    'invoice #',
    'order #',
    'transaction id',
    'thank you for your purchase',
    'thank you for your order',
    'order number',
    'confirmation number',
  ]

  const mediumWeight = [
    'receipt',
    'invoice',
    'subtotal',
    'total:',
    'amount paid',
    'billing',
    'payment',
    'charged',
    'purchased',
  ]

  const lowWeight = ['order', 'confirmation', 'thank you']

  let score = 0
  highWeight.forEach((kw) => {
    if (content.includes(kw)) score += 0.4
  })
  mediumWeight.forEach((kw) => {
    if (content.includes(kw)) score += 0.2
  })
  lowWeight.forEach((kw) => {
    if (content.includes(kw)) score += 0.1
  })

  return Math.min(score, 1)
}

/**
 * Multi-stage hard filter pipeline.
 * Returns whether email should be sent to downstream parsing.
 */
export function filterEmailForReceipt(email: ReceiptFilterEmail): FilterResult {
  const priceConfidence = detectPricePatterns(email)
  if (priceConfidence === 0) {
    return {
      shouldProcess: false,
      confidence: 0,
      rejectionReason: 'no_price_patterns',
    }
  }

  const keywordConfidence = calculateReceiptConfidence(email)
  if (
    matchesNegativePatterns(email) &&
    !(hasStrongReceiptEvidence(email) && priceConfidence >= 0.5 && keywordConfidence >= 0.4)
  ) {
    return {
      shouldProcess: false,
      confidence: 0,
      rejectionReason: 'matches_negative_pattern',
    }
  }

  const overallConfidence = priceConfidence * PRICE_WEIGHT + keywordConfidence * KEYWORD_WEIGHT

  return {
    shouldProcess: overallConfidence >= CONFIDENCE_THRESHOLD,
    confidence: overallConfidence,
    rejectionReason: overallConfidence < CONFIDENCE_THRESHOLD ? 'low_confidence' : undefined,
  }
}
