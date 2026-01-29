import type {
  EvaluationResult,
  PurchaseInput,
  ScoreExplanation,
  VerdictAlgorithm,
  VerdictOutcome,
  VendorMatch,
} from './types'
import { clamp01 } from './utils'

export const WEIGHTS = {
  intercept: -1.208324,
  value_conflict: 2.618259,
  pattern_repetition: -2.507522,
  emotional_impulse: 2.38308,
  financial_strain: 0.933266,
  long_term_utility: -2.730036,
  emotional_support: -0.835071,
} as const

const COST_SENSITIVE_WEIGHTS = {
  intercept: -0.147321,
  value_conflict: 2.667996,
  pattern_repetition: -2.568795,
  emotional_impulse: 2.353324,
  financial_strain: 0.897642,
  long_term_utility: -2.82861,
  emotional_support: -0.938034,
} as const

const COST_SENSITIVE_THRESHOLDS = {
  buy: 0.35,
  skip: 0.65,
} as const

const COST_SENSITIVE_CALIBRATION: Array<[number, number]> = [
  [0.0, 0.0],
  [0.1, 0.0],
  [0.2, 0.0],
  [0.3, 0.0],
  [0.4, 0.18],
  [0.45, 0.2],
  [0.5, 0.22],
  [0.55, 0.3],
  [0.6, 0.42],
  [0.7, 0.53],
  [0.75, 0.6],
  [0.8, 0.72],
  [0.9, 0.9],
  [1.0, 1.0],
]

export const VENDOR_RUBRIC = {
  quality: {
    definition: 'How well the product performs its intended function when it works.',
    enum: {
      low: {
        score: 0.4,
        description: 'Below-average performance; compromises are obvious.',
      },
      medium: {
        score: 0.6,
        description: 'Adequate performance; meets basic expectations.',
      },
      high: {
        score: 0.8,
        description: 'Strong performance; well-designed and efficient.',
      },
    },
  },
  reliability: {
    definition: 'How consistently the product maintains acceptable performance over time.',
    enum: {
      low: {
        score: 0.4,
        description: 'Noticeable failure risk; inconsistent durability.',
      },
      medium: {
        score: 0.6,
        description: 'Generally dependable with occasional issues.',
      },
      high: {
        score: 0.8,
        description: 'Rare failures; long-term dependable.',
      },
    },
  },
  price_tier: {
    definition: 'Relative market positioning of the product price level.',
    enum: {
      budget: {
        typical_multiplier: '<0.7x market median',
        description: 'Lowest-cost options; price is the primary selling point.',
      },
      mid_range: {
        typical_multiplier: '0.7-1.2x market median',
        description: 'Balanced cost and performance; mainstream pricing.',
      },
      premium: {
        typical_multiplier: '1.2-2x market median',
        description: 'Higher-than-average price; design, brand, or quality emphasis.',
      },
      luxury: {
        typical_multiplier: '>2x market median',
        description: 'Price driven mainly by brand, exclusivity, or status signaling.',
      },
    },
  },
} as const

const PRICE_TIER_RISK_POINTS = {
  budget: 0,
  mid_range: 4,
  premium: 8,
  luxury: 12,
} as const

export const getVendorRubricInfo = (vendorMatch?: VendorMatch | null) => {
  if (!vendorMatch) return null
  const quality = VENDOR_RUBRIC.quality.enum[vendorMatch.vendor_quality]
  const reliability = VENDOR_RUBRIC.reliability.enum[vendorMatch.vendor_reliability]
  const priceTier = VENDOR_RUBRIC.price_tier.enum[vendorMatch.vendor_price_tier]
  return { quality, reliability, priceTier }
}

const buildVendorUtilityScore = (vendorMatch?: VendorMatch | null) => {
  const info = getVendorRubricInfo(vendorMatch)
  if (!info || !vendorMatch) return null
  const utilityScore = clamp01((info.quality.score + info.reliability.score) / 2)
  const explanation = [
    `Vendor quality: ${vendorMatch.vendor_quality} (${info.quality.score}).`,
    `Vendor reliability: ${vendorMatch.vendor_reliability} (${info.reliability.score}).`,
    `Vendor price tier: ${vendorMatch.vendor_price_tier} (${info.priceTier.typical_multiplier}).`,
  ].join(' ')
  return buildScore(utilityScore, explanation)
}

const LINE_BREAK = '<br />'

const summarizeProfileContext = (summary?: string) => {
  if (!summary) return null
  if (summary.includes('Profile summary: not set.')) {
    return 'Your profile summary is not set yet, so this leans more on the purchase details.'
  }

  const parts: string[] = []
  const profileMatch = summary.match(/Profile summary:\n- (.+)/)
  if (profileMatch?.[1]) {
    const trimmed = profileMatch[1].trim().replace(/\.\s*$/, '')
    parts.push(`Your profile summary notes: ${trimmed}.`)
  }

  const budgetMatch = summary.match(/Weekly fun budget:\n- \\$([0-9.,]+)/)
  if (budgetMatch?.[1]) {
    parts.push(`Your weekly fun budget is $${budgetMatch[1]}.`)
  }

  const onboardingParts: string[] = []
  const coreValuesMatch = summary.match(/- Core values: (.+)/)
  if (coreValuesMatch?.[1]) {
    onboardingParts.push(
      `<strong>Core values:</strong> <em>"${coreValuesMatch[1]}"</em>.`
    )
  }
  const regretMatch = summary.match(/- Regret patterns: (.+)/)
  if (regretMatch?.[1]) {
    onboardingParts.push(`<strong>Regret patterns:</strong> <em>"${regretMatch[1]}"</em>.`)
  }
  const satisfactionMatch = summary.match(/- Satisfaction patterns: (.+)/)
  if (satisfactionMatch?.[1]) {
    onboardingParts.push(`<strong>Satisfaction patterns:</strong> <em>"${satisfactionMatch[1]}"</em>.`)
  }
  const decisionStyleMatch = summary.match(/- Decision style: (.+)/)
  if (decisionStyleMatch?.[1]) {
    onboardingParts.push(`<strong>Decision style:</strong> <em>"${decisionStyleMatch[1]}"</em>.`)
  }
  const financialSensitivityMatch = summary.match(/- Financial sensitivity: (.+)/)
  if (financialSensitivityMatch?.[1]) {
    onboardingParts.push(
      `<strong>Financial sensitivity:</strong> <em>"${financialSensitivityMatch[1]}"</em>.`
    )
  }
  const identityMatch = summary.match(/- Identity stability: (.+)/)
  if (identityMatch?.[1]) {
    onboardingParts.push(`Identity stability:</strong> <em>"${identityMatch[1]}"</em>.`)
  }
  const emotionalMatch = summary.match(/- Emotional relationship: (.+)/)
  if (emotionalMatch?.[1]) {
    onboardingParts.push(
      `<strong>Emotional relationship:</strong> <em>"${emotionalMatch[1]}"</em>.`
    )
  }

  if (onboardingParts.length > 0) {
    parts.push(...onboardingParts)
  }

  if (parts.length === 0) {
    return 'Your profile context guides this decision alongside the purchase details.'
  }

  return parts.join(LINE_BREAK)
}

const extractBulletLines = (text?: string) => {
  if (!text) return []
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^- /, ''))
}

const summarizePurchaseProfile = (similar?: string, recent?: string) => {
  const parts: string[] = []
  const hasRecent = extractBulletLines(recent).length > 0
  const hasSimilar = extractBulletLines(similar).length > 0

  if (hasRecent) {
    parts.push('Past purchases suggest a baseline for your usual spending and categories.')
  } else if (recent?.includes('No purchase history')) {
    parts.push('Past purchases suggest limited recent history to compare against.')
  }

  if (hasSimilar) {
    parts.push('Similar purchases suggest how comparable items have felt for you before.')
  } else if (similar?.includes('No similar purchases found')) {
    parts.push('Similar purchases suggest there are no close historical matches yet.')
  }

  return parts.length > 0 ? parts.join(LINE_BREAK) : null
}

const summarizeVendorMatch = (vendorMatch?: VendorMatch | null) => {
  if (!vendorMatch) {
    return 'Vendor quality, reliability, and price tier are not available, so this relies on the item details.'
  }
  const rubric = getVendorRubricInfo(vendorMatch)
  if (!rubric) {
    return 'Vendor quality, reliability, and price tier are not available, so this relies on the item details.'
  }
  return `The vendor is rated ${vendorMatch.vendor_quality} on quality (${rubric.quality.score}) and ${vendorMatch.vendor_reliability} on reliability (${rubric.reliability.score}), with a ${vendorMatch.vendor_price_tier} price tier (${rubric.priceTier.typical_multiplier}).`
}

const summarizeRiskSignals = (
  reasons: string[],
  patternRepetition?: ScoreExplanation,
  financialStrain?: ScoreExplanation
) => {
  const parts: string[] = []
  if (reasons.length > 0) {
    const normalizedReasons = reasons.map((reason) => reason.toLowerCase())
    const [first, second, ...rest] = normalizedReasons
    if (normalizedReasons.length === 1) {
      parts.push(`On the item itself, ${first} stands out.`)
    } else if (normalizedReasons.length === 2) {
      parts.push(`On the item itself, ${first} and ${second} stand out.`)
    } else {
      parts.push(
        `On the item itself, ${first} and ${second} stand out, plus ${rest.join(', ')}.`
      )
    }
  }

  if (patternRepetition) {
    const explanation = patternRepetition.explanation.trim().replace(/\.\s*$/, '')
    parts.push(`Pattern signal: ${explanation}.`)
  }
  if (financialStrain) {
    const explanation = financialStrain.explanation.trim().replace(/\.\s*$/, '')
    parts.push(`Budget context: ${explanation}.`)
  }

  return parts.length > 0 ? parts.join(LINE_BREAK) : null
}

export const buildScore = (score: number, explanation: string): ScoreExplanation => ({
  score: clamp01(score),
  explanation,
})

export const computeDecisionScore = (params: {
  valueConflict: number
  patternRepetition: number
  emotionalImpulse: number
  financialStrain: number
  longTermUtility: number
  emotionalSupport: number
}) => {
  return (
    WEIGHTS.intercept +
    WEIGHTS.value_conflict * params.valueConflict +
    WEIGHTS.pattern_repetition * params.patternRepetition +
    WEIGHTS.emotional_impulse * params.emotionalImpulse +
    WEIGHTS.financial_strain * params.financialStrain -
    WEIGHTS.long_term_utility * params.longTermUtility -
    WEIGHTS.emotional_support * params.emotionalSupport
  )
}

const sigmoid = (logit: number) => 1 / (1 + Math.exp(-logit))

const calibrateProbability = (rawProb: number) => {
  if (rawProb <= 0) return 0
  if (rawProb >= 1) return 1

  let lower = COST_SENSITIVE_CALIBRATION[0]
  let upper = COST_SENSITIVE_CALIBRATION[COST_SENSITIVE_CALIBRATION.length - 1]

  for (let i = 0; i < COST_SENSITIVE_CALIBRATION.length - 1; i += 1) {
    const [rawLower] = COST_SENSITIVE_CALIBRATION[i]
    const [rawUpper] = COST_SENSITIVE_CALIBRATION[i + 1]
    if (rawProb >= rawLower && rawProb <= rawUpper) {
      lower = COST_SENSITIVE_CALIBRATION[i]
      upper = COST_SENSITIVE_CALIBRATION[i + 1]
      break
    }
  }

  const [rawLow, calLow] = lower
  const [rawHigh, calHigh] = upper
  if (rawHigh === rawLow) return calLow

  const t = (rawProb - rawLow) / (rawHigh - rawLow)
  return calLow + t * (calHigh - calLow)
}

const costSensitiveDecisionFromScore = (calProb: number): VerdictOutcome => {
  if (calProb >= COST_SENSITIVE_THRESHOLDS.skip) return 'skip'
  if (calProb >= COST_SENSITIVE_THRESHOLDS.buy) return 'hold'
  return 'buy'
}

const costSensitiveConfidenceFromScore = (calProb: number, decision: VerdictOutcome) => {
  const { buy, skip } = COST_SENSITIVE_THRESHOLDS
  const holdMid = (buy + skip) / 2

  if (decision === 'buy') {
    const normalized = (buy - calProb) / buy
    return Math.min(0.95, 0.5 + 0.45 * normalized)
  }
  if (decision === 'skip') {
    const normalized = (calProb - skip) / (1 - skip)
    return Math.min(0.95, 0.5 + 0.45 * normalized)
  }

  const maxDist = (skip - buy) / 2
  const distFromMid = Math.abs(calProb - holdMid)
  return Math.max(0.5, 0.9 - 0.4 * (distFromMid / maxDist))
}

const computeCostSensitiveScore = (params: {
  valueConflict: number
  patternRepetition: number
  emotionalImpulse: number
  financialStrain: number
  longTermUtility: number
  emotionalSupport: number
}) => {
  const logit =
    COST_SENSITIVE_WEIGHTS.intercept +
    COST_SENSITIVE_WEIGHTS.value_conflict * params.valueConflict +
    COST_SENSITIVE_WEIGHTS.pattern_repetition * params.patternRepetition +
    COST_SENSITIVE_WEIGHTS.emotional_impulse * params.emotionalImpulse +
    COST_SENSITIVE_WEIGHTS.financial_strain * params.financialStrain +
    COST_SENSITIVE_WEIGHTS.long_term_utility * params.longTermUtility +
    COST_SENSITIVE_WEIGHTS.emotional_support * params.emotionalSupport

  const rawProb = sigmoid(logit)
  const calProb = calibrateProbability(rawProb)
  return { rawProb, calProb }
}

export const computeDecisionByAlgorithm = (
  algorithm: VerdictAlgorithm,
  params: {
    valueConflict: number
    patternRepetition: number
    emotionalImpulse: number
    financialStrain: number
    longTermUtility: number
    emotionalSupport: number
  }
) => {
  if (algorithm === 'cost_sensitive_iso') {
    const { rawProb, calProb } = computeCostSensitiveScore(params)
    const outcome = costSensitiveDecisionFromScore(calProb)
    return {
      outcome,
      confidence: costSensitiveConfidenceFromScore(calProb, outcome),
      decisionScore: calProb,
      rawScore: rawProb,
    }
  }

  const decisionScore = computeDecisionScore(params)
  const outcome = decisionFromScore(decisionScore)
  return {
    outcome,
    confidence: confidenceFromScore(decisionScore),
    decisionScore,
  }
}

export const decisionFromScore = (score: number): VerdictOutcome => {
  if (score >= 0.7) return 'skip'
  if (score >= 0.4) return 'hold'
  return 'buy'
}

export const confidenceFromScore = (score: number) => {
  const distance = Math.min(1, Math.abs(score - 0.5))
  return Math.max(0.5, Math.min(0.95, 0.95 - distance * 0.45))
}

export const computeFinancialStrain = (
  price: number | null,
  weeklyBudget: number | null,
  isImportant = false
) => {
  if (!price || !weeklyBudget || weeklyBudget <= 0) return 0
  if (!isImportant && price > weeklyBudget / 3) return 1
  return clamp01(price / weeklyBudget)
}

export const evaluatePurchaseFallback = (
  input: PurchaseInput,
  overrides?: {
    patternRepetition?: ScoreExplanation
    financialStrain?: ScoreExplanation
    vendorMatch?: VendorMatch | null
    profileContextSummary?: string
    similarPurchasesSummary?: string
    recentPurchasesSummary?: string
    algorithm?: VerdictAlgorithm
  }
): EvaluationResult => {
  const reasons: string[] = []
  let riskScore = 0

  if (input.price !== null) {
    if (input.price > 200) {
      riskScore += 30
      reasons.push('High price point (>$200)')
    } else if (input.price > 100) {
      riskScore += 15
      reasons.push('Moderate price point ($100-200)')
    }
  }

  const impulseCategories = ['clothing', 'fashion', 'accessories', 'gadgets', 'electronics']
  if (input.category && impulseCategories.some((c) => input.category!.toLowerCase().includes(c))) {
    riskScore += 20
    reasons.push('Category has higher impulse purchase rate')
  }

  if (!input.justification || input.justification.length < 20) {
    riskScore += 25
    reasons.push('Weak or missing justification')
  } else if (
    input.justification.toLowerCase().includes('want') &&
    !input.justification.toLowerCase().includes('need')
  ) {
    riskScore += 10
    reasons.push('Want-based rather than need-based')
  }

  const impulseKeywords = ['limited', 'sale', 'deal', 'exclusive', 'last chance', 'flash']
  if (impulseKeywords.some((kw) => input.title.toLowerCase().includes(kw))) {
    riskScore += 20
    reasons.push('Title contains urgency/scarcity language')
  }

  const vendorRubric = getVendorRubricInfo(overrides?.vendorMatch)
  if (overrides?.vendorMatch && vendorRubric) {
    const tierRisk = PRICE_TIER_RISK_POINTS[overrides.vendorMatch.vendor_price_tier]
    if (tierRisk > 0) {
      riskScore += tierRisk
      reasons.push(`Vendor price tier: ${overrides.vendorMatch.vendor_price_tier}`)
    }
  }

  const normalizedRisk = clamp01(riskScore / 100)
  const valueConflict = buildScore(normalizedRisk * 0.6, 'Fallback heuristic.')
  const emotionalImpulse = buildScore(normalizedRisk * 0.7, 'Fallback heuristic.')
  const longTermUtility =
    buildVendorUtilityScore(overrides?.vendorMatch) ??
    buildScore(0.4, 'Fallback heuristic.')
  const emotionalSupport = buildScore(0.4, 'Fallback heuristic.')
  const patternRepetition =
    overrides?.patternRepetition ??
    buildScore(0, 'No history analysis in fallback.')
  const financialStrain =
    overrides?.financialStrain ??
    buildScore(0, 'No budget context in fallback.')

  const decisionResult = computeDecisionByAlgorithm(
    overrides?.algorithm ?? 'standard',
    {
      valueConflict: valueConflict.score,
      patternRepetition: patternRepetition.score,
      emotionalImpulse: emotionalImpulse.score,
      financialStrain: financialStrain.score,
      longTermUtility: longTermUtility.score,
      emotionalSupport: emotionalSupport.score,
    }
  )

  const rationaleParts = [
    summarizeProfileContext(overrides?.profileContextSummary),
    summarizePurchaseProfile(
      overrides?.similarPurchasesSummary,
      overrides?.recentPurchasesSummary
    ),
    summarizeVendorMatch(overrides?.vendorMatch),
    summarizeRiskSignals(reasons, patternRepetition, financialStrain),
  ].filter(Boolean)

  const rationale =
    rationaleParts.length > 0
      ? rationaleParts.join(LINE_BREAK)
      : 'This recommendation leans on the purchase details because profile context is limited.'

  return {
    outcome: decisionResult.outcome,
    confidence: decisionResult.confidence,
    reasoning: {
      valueConflict,
      patternRepetition,
      emotionalImpulse,
      financialStrain,
      longTermUtility,
      emotionalSupport,
      decisionScore: decisionResult.decisionScore,
      rationale,
      importantPurchase: input.isImportant,
      algorithm: overrides?.algorithm ?? 'standard',
    },
  }
}
