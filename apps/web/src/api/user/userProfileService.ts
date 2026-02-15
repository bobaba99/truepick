import { supabase } from '../core/supabaseClient'
import type { OnboardingAnswers, UserPreferences, UserRow } from '../core/types'

const PROFILE_SELECT_FIELDS_WITH_PREFERENCES =
  'id, email, created_at, last_active, onboarding_completed, profile_summary, onboarding_answers, weekly_fun_budget, preferences'
const PROFILE_SELECT_FIELDS_LEGACY =
  'id, email, created_at, last_active, onboarding_completed, profile_summary, onboarding_answers, weekly_fun_budget'

const isMissingPreferencesColumnError = (message: string | undefined) =>
  Boolean(message && /column .*preferences.* does not exist/i.test(message))

export async function getUserProfile(userId: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select(PROFILE_SELECT_FIELDS_WITH_PREFERENCES)
    .eq('id', userId)
    .maybeSingle()

  if (error && isMissingPreferencesColumnError(error.message)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from('users')
      .select(PROFILE_SELECT_FIELDS_LEGACY)
      .eq('id', userId)
      .maybeSingle()

    if (legacyError) {
      throw new Error(legacyError.message)
    }

    return (legacyData ? { ...legacyData, preferences: null } : null) as UserRow | null
  }

  if (error) {
    throw new Error(error.message)
  }

  return data as UserRow | null
}

export type UpdateUserProfileInput = {
  profileSummary?: string | null
  onboardingAnswers?: OnboardingAnswers | null
  weeklyFunBudget?: number | null
  preferences?: UserPreferences | null
}

export async function updateUserProfile(
  userId: string,
  updates: UpdateUserProfileInput,
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {}

  if (updates.profileSummary !== undefined) {
    payload.profile_summary = updates.profileSummary
  }
  if (updates.onboardingAnswers !== undefined) {
    payload.onboarding_answers = updates.onboardingAnswers
  }
  if (updates.weeklyFunBudget !== undefined) {
    payload.weekly_fun_budget = updates.weeklyFunBudget
  }
  if (updates.preferences !== undefined) {
    payload.preferences = updates.preferences
  }

  if (Object.keys(payload).length === 0) {
    return { error: null }
  }

  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)

  if (error && 'preferences' in payload && isMissingPreferencesColumnError(error.message)) {
    delete payload.preferences
    if (Object.keys(payload).length === 0) {
      return {
        error: 'Preferences column missing in database. Run the updated schema before saving preferences.',
      }
    }

    const { error: retryError } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId)

    return { error: retryError?.message ?? null }
  }

  return { error: error?.message ?? null }
}

export async function createUserProfile(
  userId: string,
  email: string,
): Promise<{ error: string | null; isConflict: boolean }> {
  const { error } = await supabase.from('users').insert({
    id: userId,
    email,
    last_active: new Date().toISOString(),
  })

  if (error) {
    const isConflict = error.code === '23505'
    return { error: error.message, isConflict }
  }

  return { error: null, isConflict: false }
}
