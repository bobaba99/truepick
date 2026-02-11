import type { PurchaseInput, VendorMatch } from './types'
import { VENDOR_RUBRIC } from './verdictScoring'
import { computePriceThresholds } from './utils'

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

Rules:
1. If vendor data is missing, treat vendor attributes as unknown and do not invent them.
2. When evaluating, treat ratings within the last 30 days as signals for immediate regret risk, and ratings older than 6 months as signals for long-term satisfaction.
3. Do not invent or fabricate purchase history. Only reference purchases explicitly listed in the context. If no history is provided, say so honestly.
4. You must respond with valid JSON only, no markdown, no code fences, no other text.
5. Use your own judgment to set the final verdict and confidence directly based on all provided context.`
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

const buildImportantPurchasePolicy = (isImportant: boolean, weeklyBudget: number | null) => {
  if (!isImportant) return ''
  const { high, medium } = computePriceThresholds(weeklyBudget)
  const budgetNote = weeklyBudget
    ? `The user's monthly budget is $${(weeklyBudget * 4).toFixed(0)}. High price is >=$${high.toFixed(0)}, moderate is $${medium.toFixed(0)}-$${high.toFixed(0)}, low is <$${medium.toFixed(0)}.`
    : 'No budget is set, so use general judgment for price sensitivity.'
  return `
Important purchase policy (APPLIES to this purchase):
- ${budgetNote}
- This is marked as an important purchase. High price points and premium/luxury vendor tiers are tolerated and must NOT be the primary negative reason by themselves.
- Only treat price as negative when there is clear evidence of affordability strain (e.g., exceeds monthly budget significantly) or poor long-term utility.
- You must explicitly acknowledge the "important purchase" status in the rationale and state that high price is tolerated.
- If this purchase has long-term utility and is essential, approve it regardless of value conflicts and high upfront cost. Suggest financing options instead of returning "skip".
- Never return a "skip" verdict for an important purchase unless there is concrete evidence of poor long-term utility or severe affordability strain.`
}

export const buildUserPrompt = (
  input: PurchaseInput,
  profileContext: string,
  similarRecentPurchases: string,
  recentPurchases: string,
  similarLongTermPurchases: string,
  longTermPurchases: string,
  vendorMatch: VendorMatch | null,
  weeklyBudget: number | null
) => {
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
${buildImportantPurchasePolicy(input.isImportant, weeklyBudget)}

Respond with this exact JSON structure. Every field is required.

Score constraints: all "score" fields must be a number between 0.0 and 1.0 inclusive. Do not return scores outside this range.

{
  "value_conflict": {
    "score": (number 0.0-1.0, where 0 = no conflict with user values, 1 = directly contradicts user values),
    "explanation": "(one sentence, friendly and neutral)"
  },
  "emotional_impulse": {
    "score": (number 0.0-1.0, where 0 = fully rational, 1 = purely impulsive),
    "explanation": "(one sentence, friendly and neutral)"
  },
  "long_term_utility": {
    "score": (number 0.0-1.0, where 0 = no lasting value, 1 = essential long-term value),
    "explanation": "(one sentence, friendly and neutral)"
  },
  "emotional_support": {
    "score": (number 0.0-1.0, where 0 = no emotional benefit, 1 = strong emotional benefit),
    "explanation": "(one sentence, friendly and neutral)"
  },
  "short_term_regret": {
    "score": (number 0.0-1.0, where 0 = very unlikely to regret soon, 1 = very likely to regret within days),
    "explanation": "(one sentence, friendly and neutral)"
  },
  "long_term_regret": {
    "score": (number 0.0-1.0, where 0 = very unlikely to regret long-term, 1 = very likely to regret after months),
    "explanation": "(one sentence, friendly and neutral)"
  },
  "verdict": "(exactly one of: buy, hold, skip -- lowercase, no other value allowed)",
  "confidence": (number 0.0-1.0: 0.5 = uncertain, 0.7 = moderate, 0.9+ = very confident),
  "alternative_solution": "(if verdict is hold or skip: 2-3 sentences offering an alternative way to meet the same need. If verdict is buy: empty string)",
  "rationale": "(a personalized 3-4 sentence narrative. First sentence: state the recommendation and the primary reason. Second sentence: connect to user profile or values, quoting values in em tags. Third sentence: cite supporting evidence from history or vendor data. Use a warm, conversational tone. Do not include section headers, labels like Outcome, or the JSON schema instructions in this field.)"
}`
}
