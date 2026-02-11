/**
 * Central re-export for all type constants
 * Allows importing from a single location while maintaining organized structure
 *
 * Usage:
 *   // Specific import (recommended)
 *   import { PurchaseRow } from '@/constants/purchaseTypes'
 *
 *   // Re-export import (for convenience)
 *   import { PurchaseRow } from '@/constants'
 */

// Purchase types
export type {
  PurchaseRow,
  PurchaseInput,
  PurchaseCategory,
  VendorQuality,
  VendorReliability,
  VendorPriceTier,
  VendorMatch,
} from './purchaseTypes'
export { PURCHASE_CATEGORIES } from './purchaseTypes'

// Swipe types
export type {
  SwipeOutcome,
  SwipeTiming,
  SwipeRow,
  SwipeScheduleRow,
  SwipeQueueItem,
  Stats,
} from './swipeTypes'

// Verdict types
export type {
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
} from './verdictTypes'

// Resource types
export type {
  ResourceRow,
  ResourceListItem,
  ResourceUpsertInput,
} from './resourceTypes'

// User types
export type {
  UserRow,
  UserValueRow,
  OnboardingAnswers,
  UserValueType,
} from './userTypes'
export { USER_VALUE_DESCRIPTIONS } from './userTypes'

// Resource tags
export type { RecommendedTag } from './resourceTags'
export { RECOMMENDED_TAGS } from './resourceTags'
