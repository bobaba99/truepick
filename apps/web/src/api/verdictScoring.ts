import type {
  EvaluationResult,
  PurchaseInput,
  ScoreExplanation,
  VerdictOutcome,
  VendorMatch,
} from './types'
import { clamp01, computePriceThresholds } from './utils'

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
    weeklyBudget?: number | null
  }
): EvaluationResult => {
  const reasons: string[] = []
  let riskScore = 0

  const { high, medium } = computePriceThresholds(overrides?.weeklyBudget ?? null)
  if (input.price !== null) {
    if (input.price >= high) {
      riskScore += 30
      reasons.push(`High price point (>=$${high.toFixed(0)})`)
    } else if (input.price >= medium) {
      riskScore += 15
      reasons.push(`Moderate price point ($${medium.toFixed(0)}-$${high.toFixed(0)})`)
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
  const decisionScore = normalizedRisk
  const outcome = decisionFromScore(decisionScore)
  const decisionResult = {
    outcome,
    confidence: confidenceFromScore(decisionScore),
    decisionScore,
  }

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
      algorithm: 'llm_only',
    },
  }
}
