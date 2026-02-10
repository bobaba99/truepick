// Shared types for database rows and API responses

export type SwipeOutcome = 'satisfied' | 'regret' | 'not_sure'

export type SwipeTiming = 'immediate' | 'day3' | 'week3' | 'month3'

export type VerdictOutcome = 'buy' | 'hold' | 'skip'

export type VerdictAlgorithm = 'standard' | 'cost_sensitive_iso' | 'llm_only'

export type UserDecision = 'bought' | 'hold' | 'skip'

export type PurchaseRow = {
  id: string
  title: string
  price: number
  vendor: string | null
  category: string | null
  purchase_date: string
  source?: string | null
  verdict_id?: string | null
  created_at?: string | null
}

export type SwipeRow = {
  id: string
  user_id: string
  purchase_id: string
  schedule_id?: string | null
  timing?: SwipeTiming | null
  outcome: SwipeOutcome
  rated_at?: string | null
  created_at: string
}

export type SwipeScheduleRow = {
  id: string
  user_id: string
  purchase_id: string
  timing: SwipeTiming
  scheduled_for: string
  completed_at: string | null
  created_at: string
}

export type SwipeQueueItem = {
  schedule_id: string
  timing: SwipeTiming
  scheduled_for: string
  purchase: PurchaseRow
}

export type VerdictRow = {
  id: string
  candidate_title: string
  candidate_price: number | null
  candidate_category?: string | null
  candidate_vendor?: string | null
  scoring_model?: VerdictAlgorithm | null
  justification?: string | null
  predicted_outcome: VerdictOutcome | null
  reasoning?: Record<string, unknown> | null
  hold_release_at: string | null
  user_proceeded?: boolean | null
  actual_outcome?: string | null
  user_decision?: UserDecision | null
  user_hold_until?: string | null
  created_at: string | null
}

export type UserRow = {
  id: string
  email: string
  created_at: string | null
  last_active: string | null
  onboarding_completed: boolean | null
  profile_summary?: string | null
  onboarding_answers?: OnboardingAnswers | null
  weekly_fun_budget?: number | null
}

export type UserValueRow = {
  id: string
  value_type: string
  preference_score: number | null
  created_at: string | null
}

export type OnboardingAnswers = {
  coreValues: string[]
  regretPatterns: string[]
  satisfactionPatterns: string[]
  decisionStyle: string
  neuroticismScore: number
  materialism: {
    centrality: number
    happiness: number
    success: number
  }
  locusOfControl: {
    workHard: number
    destiny: number
  }
  identityStability: string
}

export type Stats = {
  swipesCompleted: number
  regretRate: number
  activeHolds: number
}

export type PurchaseInput = {
  title: string
  price: number | null
  category: string | null
  vendor: string | null
  justification: string | null
  isImportant: boolean
}

export type VendorQuality = 'low' | 'medium' | 'high'

export type VendorReliability = 'low' | 'medium' | 'high'

export type VendorPriceTier = 'budget' | 'mid_range' | 'premium' | 'luxury'

export type VendorMatch = {
  vendor_id: number
  vendor_name: string
  vendor_category: string
  vendor_quality: VendorQuality
  vendor_reliability: VendorReliability
  vendor_price_tier: VendorPriceTier
}

export type EvaluationResult = {
  outcome: VerdictOutcome
  confidence: number
  reasoning: LLMEvaluationReasoning
}

export type ScoreExplanation = {
  score: number
  explanation: string
}

// LLM evaluation response types (matches evaluate_logic_v3.md schema)
export type LLMEvaluationReasoning = {
  valueConflict?: ScoreExplanation
  patternRepetition?: ScoreExplanation
  emotionalImpulse?: ScoreExplanation
  financialStrain?: ScoreExplanation
  longTermUtility?: ScoreExplanation
  emotionalSupport?: ScoreExplanation
  shortTermRegret?: ScoreExplanation
  longTermRegret?: ScoreExplanation
  alternativeSolution?: string
  decisionScore?: number
  rationale?: string
  importantPurchase?: boolean
  algorithm?: VerdictAlgorithm
  // Legacy fields for backward compatibility
  valueConflictScore?: ValueConflictScore
  patternRepetitionRisk?: PatternRepetitionRisk
}

export type ValueConflictScore = {
  score: number // 0-5: 0 = no conflict, 5 = direct contradiction
  explanation: string
}

export type PatternRepetitionRisk = {
  score: number // 0-5: 0 = no similarity to regrets, 5 = highly risky
  explanation: string
}

// Raw LLM response format (for parsing)
export type LLMEvaluationResponse = {
  value_conflict: ScoreExplanation
  emotional_impulse: ScoreExplanation
  long_term_utility: ScoreExplanation
  emotional_support: ScoreExplanation
  short_term_regret: ScoreExplanation
  long_term_regret: ScoreExplanation
  alternative_solution: string
  rationale: string
  verdict?: VerdictOutcome
  confidence?: number
}

// User value types matching database enum
export type UserValueType =
  | 'durability'
  | 'efficiency'
  | 'aesthetics'
  | 'interpersonal_value'
  | 'emotional_value'

export const USER_VALUE_DESCRIPTIONS: Record<UserValueType, string> = {
  durability: 'I value things that last several years.',
  efficiency: 'I value tools that save time for me.',
  aesthetics: "I value items that fit my existing environment's visual language.",
  interpersonal_value: 'I value purchases that facilitate shared experiences.',
  emotional_value: 'I value purchases that provide meaningful emotional benefits.',
}

export const PURCHASE_CATEGORIES = [
  { value: 'uncategorized', label: 'Uncategorized' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'home_goods', label: 'Home goods' },
  { value: 'health_wellness', label: 'Health & wellness' },
  { value: 'travel', label: 'Travel' },
  { value: 'experiences', label: 'Experiences' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'food_beverage', label: 'Food & beverage' },
  { value: 'services', label: 'Services' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
] as const

export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number]['value']
