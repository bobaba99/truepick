import { supabase } from '../core/supabaseClient'
import type { UserValueRow } from '../core/types'

export async function getUserValues(userId: string): Promise<UserValueRow[]> {
  const { data, error } = await supabase
    .from('user_values')
    .select('id, value_type, preference_score, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as UserValueRow[]
}

export async function createUserValue(
  valueType: string,
  preferenceScore: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('add_user_value', {
    p_value_type: valueType,
    p_preference_score: preferenceScore,
  })

  return { error: error?.message ?? null }
}

export async function updateUserValue(
  userId: string,
  valueId: string,
  preferenceScore: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_values')
    .update({ preference_score: preferenceScore })
    .eq('id', valueId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export async function deleteUserValue(
  userId: string,
  valueId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_values')
    .delete()
    .eq('id', valueId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}
