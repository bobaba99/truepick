/**
 * Verdict and LLM evaluation types
 * Used by: verdictService, verdictScoring, verdictContext, verdictPrompts, Dashboard, VerdictDetailModal
 */

/**
 * Final recommendation outcome
 */
export type VerdictOutcome = 'buy' | 'hold' | 'skip'

/**
 * Verdict algorithm version used for scoring
 */
export type VerdictAlgorithm = 'standard' | 'cost_sensitive_iso' | 'llm_only'

/**
 * User's final decision on the purchase
 */
export type UserDecision = 'bought' | 'hold' | 'skip'

/**
 * Database row for a verdict record
 */
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

/**
 * Score with explanation for a single evaluation dimension
 */
export type ScoreExplanation = {
  score: number
  explanation: string
}

/**
 * LLM evaluation reasoning structure (matches evaluate_logic_v3.md schema)
 */
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

/**
 * Legacy: Value conflict score with explanation
 * @deprecated Use ScoreExplanation in valueConflict field instead
 */
export type ValueConflictScore = {
  score: number // 0-5: 0 = no conflict, 5 = direct contradiction
  explanation: string
}

/**
 * Legacy: Pattern repetition risk assessment
 * @deprecated Use ScoreExplanation in patternRepetition field instead
 */
export type PatternRepetitionRisk = {
  score: number // 0-5: 0 = no similarity to regrets, 5 = highly risky
  explanation: string
}

/**
 * Raw LLM response format from API (for parsing)
 */
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

/**
 * Complete evaluation result with outcome, confidence, and reasoning
 */
export type EvaluationResult = {
  outcome: VerdictOutcome
  confidence: number
  reasoning: LLMEvaluationReasoning
}
