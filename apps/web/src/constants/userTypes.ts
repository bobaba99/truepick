/**
 * User profile and onboarding types
 * Used by: userProfileService, userValueService, verdictContext, Profile page
 */

export type ThemeMode = 'light' | 'dark'
export type HoldDurationHours = 24 | 48 | 72

export type UserPreferences = {
  theme: ThemeMode
  currency: string
  hold_duration_hours: HoldDurationHours
  hold_reminders_enabled: boolean
}

/**
 * Complete user profile database row
 */
export type UserRow = {
  id: string
  email: string
  created_at: string | null
  last_active: string | null
  onboarding_completed: boolean | null
  profile_summary?: string | null
  onboarding_answers?: OnboardingAnswers | null
  weekly_fun_budget?: number | null
  preferences?: UserPreferences | null
}

/**
 * User's personal values assessment from onboarding
 */
export type UserValueRow = {
  id: string
  value_type: string
  preference_score: number | null
  created_at: string | null
}

/**
 * Complete onboarding questionnaire responses
 * Used to build user's psychological profile for personalized verdicts
 */
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

/**
 * User value types matching database enum
 */
export type UserValueType =
  | 'durability'
  | 'efficiency'
  | 'aesthetics'
  | 'interpersonal_value'
  | 'emotional_value'

/**
 * Human-readable descriptions for each user value type
 */
export const USER_VALUE_DESCRIPTIONS: Record<UserValueType, string> = {
  durability: 'I value things that last several years.',
  efficiency: 'I value tools that save time for me.',
  aesthetics: "I value items that fit my existing environment's visual language.",
  interpersonal_value: 'I value purchases that facilitate shared entertainment.',
  emotional_value: 'I value purchases that provide meaningful emotional benefits.',
}
