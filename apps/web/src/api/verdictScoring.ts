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
  // Original 6 features
  intercept: 0.627685,
  value_conflict: 2.438147,
  pattern_repetition: -2.792755,
  emotional_impulse: 1.275967,
  financial_strain: 0.982964,
  longTerm_utility: -2.244344,
  emotional_support: -1.444325,

  // NEW: Personality traits
  neuroticism: 1.919056,
  materialism: 0.554621,
  locus_of_control: 1.023947
} as const

const COST_SENSITIVE_WEIGHTS = {
  // Original 6 features
  intercept: 0.627685,
  value_conflict: 2.438147,
  pattern_repetition: -2.792755,
  emotional_impulse: 1.275967,
  financial_strain: 0.982964,
  longTerm_utility: -2.244344,
  emotional_support: -1.444325,

  // NEW: Personality traits
  neuroticism: 1.919056,
  materialism: 0.554621,
  locus_of_control: 1.023947
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
  [0.35, 0.2],
  [0.45, 0.25],
  [0.55, 0.35],
  [0.65, 0.45],
  [0.75, 0.6],
  [0.85, 0.8],
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

const parseProfileData = (summary?: string) => {
  if (!summary || summary.includes('Profile summary: not set.')) return null
  
  const extract = (key: string) => {
    const regex = new RegExp(`- ${key}.*: (.+)`)
    const match = summary.match(regex)
    return match?.[1]?.trim()
  }

  const budgetMatch = summary.match(/Weekly fun budget:\n- \\$([0-9.,]+)/)
  const summaryMatch = summary.match(/Profile summary:\n- (.+)/)

  return {
    summary: summaryMatch?.[1]?.trim(),
    budget: budgetMatch?.[1]?.trim(),
    coreValues: extract('Core values'),
    regretPatterns: extract('Regret patterns'),
    satisfactionPatterns: extract('Satisfaction patterns'),
    decisionStyle: extract('Decision approach'),
  }
}

const buildAlternativeSolution = (input: PurchaseInput) => {
  const suggestions: string[] = []

  if (!input.justification || input.justification.length < 20) {
    suggestions.push('Write down the specific problem this solves and revisit it after 24 hours.')
  }

  if (input.price !== null) {
    suggestions.push('Try a lower-priced or second-hand option first, or set a price alert.')
  }

  if (suggestions.length === 0) {
    suggestions.push('Try a smaller, reversible step such as borrowing, renting, or a trial.')
  }

  if (suggestions.length === 1) {
    suggestions.push('If it still feels essential later, you can proceed with more confidence.')
  }

  return suggestions.slice(0, 2).join(' ')
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
  neuroticism: number
  materialism: number
  locusOfControl: number
}) => {
  return (
    WEIGHTS.intercept +
    WEIGHTS.value_conflict * params.valueConflict +
    WEIGHTS.pattern_repetition * params.patternRepetition +
    WEIGHTS.emotional_impulse * params.emotionalImpulse +
    WEIGHTS.financial_strain * params.financialStrain -
    WEIGHTS.longTerm_utility * params.longTermUtility -
    WEIGHTS.emotional_support * params.emotionalSupport +
    WEIGHTS.neuroticism * params.neuroticism +
    WEIGHTS.materialism * params.materialism +
    WEIGHTS.locus_of_control * params.locusOfControl
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
  neuroticism: number
  materialism: number
  locusOfControl: number
}) => {
  const logit =
    COST_SENSITIVE_WEIGHTS.intercept +
    COST_SENSITIVE_WEIGHTS.value_conflict * params.valueConflict +
    COST_SENSITIVE_WEIGHTS.pattern_repetition * params.patternRepetition +
    COST_SENSITIVE_WEIGHTS.emotional_impulse * params.emotionalImpulse +
    COST_SENSITIVE_WEIGHTS.financial_strain * params.financialStrain +
    COST_SENSITIVE_WEIGHTS.longTerm_utility * params.longTermUtility +
    COST_SENSITIVE_WEIGHTS.emotional_support * params.emotionalSupport +
    COST_SENSITIVE_WEIGHTS.neuroticism * params.neuroticism +
    COST_SENSITIVE_WEIGHTS.materialism * params.materialism +
    COST_SENSITIVE_WEIGHTS.locus_of_control * params.locusOfControl

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
    neuroticism: number
    materialism: number
    locusOfControl: number
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
    psychScores?: {
      neuroticism: number
      materialism: number
      locusOfControl: number
    }
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
      neuroticism: overrides?.psychScores?.neuroticism ?? 0,
      materialism: overrides?.psychScores?.materialism ?? 0,
      locusOfControl: overrides?.psychScores?.locusOfControl ?? 0,
    }
  )

  const alternativeSolution =
    decisionResult.outcome === 'buy' ? null : buildAlternativeSolution(input)

  const outcomeMessage =
    decisionResult.outcome === 'buy'
      ? 'This purchase is recommended'
      : decisionResult.outcome === 'hold'
        ? 'Holding for 24 hours is recommended'
        : 'Skipping this purchase is recommended'

  // Build narrative rationale
  const profile = parseProfileData(overrides?.profileContextSummary)
  let rationale = outcomeMessage

  // 1. Primary Reason
  if (reasons.length > 0) {
    const mainReasons = reasons.map((r) => r.toLowerCase()).join(' and ')
    rationale += ` primarily because ${mainReasons}.`
  } else {
    rationale += ' as it aligns with your typical spending baseline.'
  }

  // 2. Profile Connection
  if (profile) {
    rationale += ' '
    if (decisionResult.outcome !== 'buy') {
      if (
        profile.regretPatterns &&
        reasons.some((r) => r.includes('impulse') || r.includes('urgency'))
      ) {
        rationale += `This mirrors your regret pattern of "${profile.regretPatterns}".`
      } else if (profile.coreValues) {
        rationale += `This may conflict with your core values of <em>${profile.coreValues}</em>.`
      } else {
        rationale += `This contrasts with your profile focus on ${profile.summary || 'stability'}.`
      }
    } else {
      if (profile.satisfactionPatterns) {
        rationale += `This aligns with your satisfaction pattern: "${profile.satisfactionPatterns}".`
      } else if (profile.coreValues) {
        rationale += `This supports your values of <em>${profile.coreValues}</em>.`
      }
    }

    if (profile.budget && financialStrain.score > 0.5) {
      rationale += ` Additionally, the price is significant relative to your weekly budget of $${profile.budget}.`
    }
  }

  // 3. Vendor/History
  if (overrides?.vendorMatch) {
    const v = overrides.vendorMatch
    rationale += ` The vendor ${v.vendor_name} is rated ${v.vendor_quality} quality.`
  }

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
      alternativeSolution: alternativeSolution ?? undefined,
      rationale,
      importantPurchase: input.isImportant,
      algorithm: overrides?.algorithm ?? 'standard',
    },
  }
}
