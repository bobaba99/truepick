import { supabase } from '../core/supabaseClient'
import type { OnboardingAnswers, UserRow } from '../core/types'

export async function getUserProfile(userId: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select(
      'id, email, created_at, last_active, onboarding_completed, profile_summary, onboarding_answers, weekly_fun_budget',
    )
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as UserRow | null
}

export type UpdateUserProfileInput = {
  profileSummary?: string | null
  onboardingAnswers?: OnboardingAnswers | null
  weeklyFunBudget?: number | null
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

  if (Object.keys(payload).length === 0) {
    return { error: null }
  }

  const { error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)

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
