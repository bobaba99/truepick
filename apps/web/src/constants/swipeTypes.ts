/**
 * Swipe-related types for delayed regret evaluation
 * Used by: swipeService, Swipe page
 */

import type { PurchaseRow } from './purchaseTypes'

/**
 * User's assessment of purchase satisfaction
 */
export type SwipeOutcome = 'satisfied' | 'regret' | 'not_sure'

/**
 * Scheduled timing for follow-up swipe prompts
 */
export type SwipeTiming = 'immediate' | 'day3' | 'week3' | 'month3'

/**
 * Database row for a completed swipe rating
 */
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

/**
 * Database row for a scheduled swipe prompt
 */
export type SwipeScheduleRow = {
  id: string
  user_id: string
  purchase_id: string
  timing: SwipeTiming
  scheduled_for: string
  completed_at: string | null
  created_at: string
}

/**
 * Queue item for displaying pending swipes to user
 * Combines schedule metadata with purchase details
 */
export type SwipeQueueItem = {
  schedule_id: string
  timing: SwipeTiming
  scheduled_for: string
  purchase: PurchaseRow
}

/**
 * User statistics derived from swipe data
 */
export type Stats = {
  swipesCompleted: number
  regretRate: number
  activeHolds: number
}
