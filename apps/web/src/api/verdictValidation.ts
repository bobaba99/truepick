import type { LLMEvaluationResponse, PurchaseInput } from './types'
import { classifyPriceTier } from './utils'

// Regex patterns for price tolerance detection
const PRICE_TOLERANCE_PATTERNS = [
  /price.{0,24}(tolerable|acceptable|reasonable|justified)/,
  /(premium|luxury).{0,24}(acceptable|reasonable|justified|warranted)/,
  /(worth|justified).{0,24}(higher price|higher cost|premium)/,
  /not (a|the) dealbreaker/,
  /not (by itself|by themselves)/,
  /(despite|even with).{0,24}(high price|premium|luxury)/,
] as const

// Regex patterns for important purchase detection
const IMPORTANT_PURCHASE_PATTERNS = [
  /\bimportant purchase\b/,
  /\bis important\b/,
  /\bhigh[-\s]?priority\b/,
  /\bpriority purchase\b/,
] as const

// Regex patterns for high price as primary negative
const HIGH_PRICE_PRIMARY_NEGATIVE_PATTERN =
  /(primary|primarily|mainly|chief|key|main|biggest concern|primary concern|main reason).{0,40}(high price|expensive|premium|luxury|cost|overpriced|price point)/

const HIGH_PRICE_PRIMARY_NEGATIVE_REVERSE_PATTERN =
  /(high price|expensive|premium|luxury|cost|overpriced|price point).{0,40}(primary|primarily|mainly|chief|key|main|biggest concern|primary concern|main reason)/

// Prompt template leak markers
const PROMPT_LEAK_MARKERS = [
  'respond with this exact json',
  'score constraints:',
  'every field is required',
  'use a warm, conversational tone',
  'do not include section headers',
  'one sentence, friendly and neutral',
  'number 0.0-1.0',
  'important purchase policy (applies',
  'exactly one of: buy, hold, skip',
] as const

// Essential signal tokens for important purchases
const ESSENTIAL_SIGNAL_TOKENS = [
  'essential',
  'for work',
  'required',
  'need',
  'photo',
  'video',
  'editing',
  'machine learning',
  'ml',
] as const

// Affordability evidence tokens
const AFFORDABILITY_EVIDENCE_TOKENS = [
  'financial strain',
  'over budget',
  'cannot afford',
  "can't afford",
  'affordability concern',
  'strain on affordability',
  'weekly fun budget',
] as const

// Long-term utility evidence tokens
const LONG_TERM_UTILITY_EVIDENCE_TOKENS = [
  'long-term utility',
  'long term utility',
  'low utility',
  'unlikely to use',
  "didn't get used",
  'poor durability',
] as const

export type VendorPriceTier = 'budget' | 'mid_range' | 'premium' | 'luxury' | null

export const hasAnyToken = (text: string, tokens: readonly string[]): boolean =>
  tokens.some((token) => text.includes(token))

export const hasPriceToleranceLanguage = (text: string): boolean =>
  PRICE_TOLERANCE_PATTERNS.some((pattern) => pattern.test(text))

export const hasPromptTemplateLeak = (text: unknown): boolean => {
  if (typeof text !== 'string') {
    return true
  }
  const normalized = text.toLowerCase()
  return PROMPT_LEAK_MARKERS.some((marker) => normalized.includes(marker))
}

export const isEssentialImportantHighUtilityPurchase = (
  input: PurchaseInput,
  llmResponse: LLMEvaluationResponse,
  vendorPriceTier: VendorPriceTier,
  weeklyBudget: number | null
): boolean => {
  if (!input.isImportant) {
    return false
  }

  const justification = (input.justification ?? '').toLowerCase()
  const hasEssentialSignal = hasAnyToken(justification, ESSENTIAL_SIGNAL_TOKENS)
  const hasStrongLongTermUtility =
    typeof llmResponse.long_term_utility?.score === 'number' &&
    llmResponse.long_term_utility.score >= 0.65
  const priceTier = classifyPriceTier(input.price, weeklyBudget)
  const hasHighPriceOrPremiumTier =
    priceTier === 'high' || vendorPriceTier === 'premium' || vendorPriceTier === 'luxury'

  return hasEssentialSignal && hasStrongLongTermUtility && hasHighPriceOrPremiumTier
}

export type ValidationResult = { isValid: boolean; reason?: string }

export const validateImportantPurchaseRationale = (
  input: PurchaseInput,
  llmResponse: LLMEvaluationResponse,
  vendorPriceTier: VendorPriceTier,
  weeklyBudget: number | null
): ValidationResult => {
  if (!input.isImportant) {
    return { isValid: true }
  }

  const rationale =
    (typeof llmResponse.rationale === 'string' ? llmResponse.rationale : '')
      .toLowerCase()
      .trim()

  if (!rationale) {
    return { isValid: false, reason: 'Missing rationale for important purchase.' }
  }

  const mentionsImportantPurchase = IMPORTANT_PURCHASE_PATTERNS.some((pattern) =>
    pattern.test(rationale)
  )
  if (!mentionsImportantPurchase) {
    return {
      isValid: false,
      reason: 'Rationale must explicitly acknowledge this is an important purchase.',
    }
  }

  if (!hasPriceToleranceLanguage(rationale)) {
    return {
      isValid: false,
      reason:
        'Rationale must explicitly state that high price/premium tier is tolerated for important purchases.',
    }
  }

  const flagsHighPriceAsPrimaryNegative =
    HIGH_PRICE_PRIMARY_NEGATIVE_PATTERN.test(rationale) ||
    HIGH_PRICE_PRIMARY_NEGATIVE_REVERSE_PATTERN.test(rationale)

  if (!flagsHighPriceAsPrimaryNegative) {
    return { isValid: true }
  }

  const hasAffordabilityEvidence = hasAnyToken(rationale, AFFORDABILITY_EVIDENCE_TOKENS)
  const hasLongTermUtilityEvidence = hasAnyToken(rationale, LONG_TERM_UTILITY_EVIDENCE_TOKENS)

  if (!hasAffordabilityEvidence && !hasLongTermUtilityEvidence) {
    return {
      isValid: false,
      reason:
        'Rationale treats high price/premium tier as the primary negative reason without affordability strain or low long-term utility evidence.',
    }
  }

  if (
    llmResponse.verdict === 'skip' &&
    isEssentialImportantHighUtilityPurchase(input, llmResponse, vendorPriceTier, weeklyBudget)
  ) {
    return {
      isValid: false,
      reason:
        "Important essential purchases with strong long-term utility and high price/premium tier must not return a 'skip' verdict.",
    }
  }

  return { isValid: true }
}
