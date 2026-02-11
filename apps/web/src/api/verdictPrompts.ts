import type { PurchaseInput, VerdictAlgorithm, VendorMatch } from './types'
import { VENDOR_RUBRIC } from './verdictScoring'

const LLM_ONLY_POLICY_INSTRUCTION =
  '\nFor this request, use your own judgment to set the final verdict and confidence directly.\nCritical policy for LLM-only mode: when Important purchase is "Yes", high price points (including >$200) and premium/luxury vendor tiers are tolerated and must not be used as the primary negative reason by themselves.\nOnly treat price as negative for Important purchases when there is clear evidence of affordability strain or poor long-term utility.\nWhen Important purchase is "Yes", explicitly mention this tolerance policy in the rationale.'

const IMPORTANT_PURCHASE_POLICY_INSTRUCTION = `If it is an important purchase, treat it as an essential item and high price/premium tier is tolerated unless there is poor long-term utility evidence.
If it is a high price/premium tier purchase with long-term utility and essential, approve the purchase regardless of value conflicts and high upfront cost,
add a suggestion for financiing options, but never return a 'skip' verdict.`

export const buildSystemPrompt = () => {
  return `Role: You are a purchase evaluator. Your responsibility is to score purchase motivations and long-term utility against the user's profile and history.

Vendor rubric to use when vendor data is provided:
- Quality: ${VENDOR_RUBRIC.quality.definition}
  - low (${VENDOR_RUBRIC.quality.enum.low.score}): ${VENDOR_RUBRIC.quality.enum.low.description}
  - medium (${VENDOR_RUBRIC.quality.enum.medium.score}): ${VENDOR_RUBRIC.quality.enum.medium.description}
  - high (${VENDOR_RUBRIC.quality.enum.high.score}): ${VENDOR_RUBRIC.quality.enum.high.description}
- Reliability: ${VENDOR_RUBRIC.reliability.definition}
  - low (${VENDOR_RUBRIC.reliability.enum.low.score}): ${VENDOR_RUBRIC.reliability.enum.low.description}
  - medium (${VENDOR_RUBRIC.reliability.enum.medium.score}): ${VENDOR_RUBRIC.reliability.enum.medium.description}
  - high (${VENDOR_RUBRIC.reliability.enum.high.score}): ${VENDOR_RUBRIC.reliability.enum.high.description}
- Price tier: ${VENDOR_RUBRIC.price_tier.definition}
  - budget (${VENDOR_RUBRIC.price_tier.enum.budget.typical_multiplier}): ${VENDOR_RUBRIC.price_tier.enum.budget.description}
  - mid_range (${VENDOR_RUBRIC.price_tier.enum.mid_range.typical_multiplier}): ${VENDOR_RUBRIC.price_tier.enum.mid_range.description}
  - premium (${VENDOR_RUBRIC.price_tier.enum.premium.typical_multiplier}): ${VENDOR_RUBRIC.price_tier.enum.premium.description}
  - luxury (${VENDOR_RUBRIC.price_tier.enum.luxury.typical_multiplier}): ${VENDOR_RUBRIC.price_tier.enum.luxury.description}

If vendor data is missing, treat vendor attributes as unknown and do not invent them.

When evaluating, treat ratings within the last 30 days as signals for immediate regret risk, and ratings older than 6 months as signals for long-term satisfaction.

You must respond with valid JSON only, no other text.`
}

const formatVendorMatch = (vendorMatch: VendorMatch | null) => {
  if (!vendorMatch) {
    return 'Vendor match: not found in vendor database.'
  }

  const quality = VENDOR_RUBRIC.quality.enum[vendorMatch.vendor_quality]
  const reliability = VENDOR_RUBRIC.reliability.enum[vendorMatch.vendor_reliability]
  const priceTier = VENDOR_RUBRIC.price_tier.enum[vendorMatch.vendor_price_tier]

  return [
    `Vendor match: ${vendorMatch.vendor_name} (${vendorMatch.vendor_category})`,
    `- Quality: ${vendorMatch.vendor_quality} (${quality.score}) - ${quality.description}`,
    `- Reliability: ${vendorMatch.vendor_reliability} (${reliability.score}) - ${reliability.description}`,
    `- Price tier: ${vendorMatch.vendor_price_tier} (${priceTier.typical_multiplier}) - ${priceTier.description}`,
  ].join('\n')
}

export const buildUserPrompt = (
  input: PurchaseInput,
  profileContext: string,
  similarRecentPurchases: string,
  recentPurchases: string,
  similarLongTermPurchases: string,
  longTermPurchases: string,
  vendorMatch: VendorMatch | null,
  algorithm: VerdictAlgorithm
) => {
  const llmOnlyInstruction = algorithm === 'llm_only' ? LLM_ONLY_POLICY_INSTRUCTION : ''

  return `${profileContext}

Immediate regret signals (ratings within last 30 days):
${recentPurchases}
${similarRecentPurchases}

Long-term satisfaction signals (ratings older than 6 months):
${longTermPurchases}
${similarLongTermPurchases}

${formatVendorMatch(vendorMatch)}

Now evaluate this purchase:
- Item: ${input.title}
- Price: ${input.price !== null ? `$${input.price.toFixed(2)}` : 'Not specified'}
- Category: ${input.category ?? 'Uncategorized'}
- Vendor: ${input.vendor ?? 'Not specified'}
- User rationale: "${input.justification ?? 'No rationale provided'}"
- Important purchase: ${input.isImportant ? 'Yes' : 'No'}
${IMPORTANT_PURCHASE_POLICY_INSTRUCTION}
${llmOnlyInstruction}

Output the final verdict and scoring in this exact JSON format:
{
  "value_conflict": {
    "score": <number 0-1>,
    "explanation": "<brief explanation, be friendly and neutral>"
  },
  "emotional_impulse": {
    "score": <number 0-1>,
    "explanation": "<brief explanation, be friendly and neutral>"
  },
  "long_term_utility": {
    "score": <number 0-1>,
    "explanation": "<brief explanation, be friendly and neutral>"
  },
  "emotional_support": {
    "score": <number 0-1>,
    "explanation": "<brief explanation, be friendly and neutral>"
  },
  "short_term_regret": {
    "score": <number 0-1>,
    "explanation": "<brief explanation of short-term regret risk, be friendly and neutral>"
  },
  "long_term_regret": {
    "score": <number 0-1>,
    "explanation": "<brief explanation of long-term regret risk, be friendly and neutral>"
  },
  "verdict": "<one of: buy, hold, skip>",
  "confidence": <number 0-1, how confident you are in this recommendation>,
  "alternative_solution": "<2-3 sentences offering an alternative way to meet the same need if the verdict is hold/skip>",
  "rationale": "<Write a personalized 3-4 sentence narrative explaining the recommendation. CRITICAL: Do not just list facts. Connect the evidence (price, vendor, history) directly to the decision. Example: 'We recommend holding because [Reason], which conflicts with your value of [Value].' Structure: (1) recommendation and main reason, (2) connection to user profile/values (quote values in <em> tags), (3) supporting evidence from history/vendor. Do not output section headers or labels in this field. Use a warm, conversational tone.>"
}`
}
