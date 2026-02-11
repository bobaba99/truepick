/**
 * @deprecated This file is maintained for backward compatibility only
 * New imports should use specific type files from @/constants/
 *
 * Migration guide:
 *   OLD: import { PurchaseRow } from './types'
 *   NEW: import { PurchaseRow } from '../constants/purchaseTypes'
 *
 * All types have been organized into domain-specific files:
 *   - purchaseTypes.ts: Purchase, vendor, and category types
 *   - swipeTypes.ts: Swipe outcomes, timing, and queue types
 *   - verdictTypes.ts: Verdict, evaluation, and LLM types
 *   - resourceTypes.ts: Article/resource types
 *   - userTypes.ts: User profile and onboarding types
 *   - resourceTags.ts: Recommended tags for articles
 */

// Re-export all types for backward compatibility
export type {
  // Purchase types
  PurchaseRow,
  PurchaseInput,
  PurchaseCategory,
  VendorQuality,
  VendorReliability,
  VendorPriceTier,
  VendorMatch,
  // Swipe types
  SwipeOutcome,
  SwipeTiming,
  SwipeRow,
  SwipeScheduleRow,
  SwipeQueueItem,
  Stats,
  // Verdict types
  VerdictOutcome,
  VerdictAlgorithm,
  UserDecision,
  VerdictRow,
  ScoreExplanation,
  LLMEvaluationReasoning,
  ValueConflictScore,
  PatternRepetitionRisk,
  LLMEvaluationResponse,
  EvaluationResult,
  // Resource types
  ResourceRow,
  ResourceListItem,
  ResourceUpsertInput,
  // User types
  UserRow,
  UserValueRow,
  OnboardingAnswers,
  UserValueType,
} from '../constants'

export { PURCHASE_CATEGORIES, USER_VALUE_DESCRIPTIONS } from '../constants'
