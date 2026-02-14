/**
 * Email Connection Service
 * CRUD operations for email_connections table (Gmail/Outlook OAuth tokens)
 */

import { supabase } from '../core/supabaseClient'

export type EmailProvider = 'gmail' | 'outlook'

export type EmailConnectionRow = {
  id: string
  user_id: string
  provider: EmailProvider
  encrypted_token: string
  refresh_token: string | null
  token_expires_at: string | null
  last_sync: string | null
  is_active: boolean
  created_at: string
}

export type EmailConnectionInput = {
  provider: EmailProvider
  accessToken: string
  refreshToken?: string | null
  expiresAt?: Date | null
}

/**
 * Get the active email connection for a user
 */
export async function getEmailConnection(
  userId: string
): Promise<EmailConnectionRow | null> {
  const { data, error } = await supabase
    .from('email_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data as EmailConnectionRow
}

/**
 * Save or update an email connection (upsert by user_id)
 * Note: In production, tokens should be encrypted before storage
 */
export async function saveEmailConnection(
  userId: string,
  input: EmailConnectionInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('email_connections').upsert(
    {
      user_id: userId,
      provider: input.provider,
      encrypted_token: input.accessToken, // TODO: encrypt in production
      refresh_token: input.refreshToken ?? null,
      token_expires_at: input.expiresAt?.toISOString() ?? null,
      is_active: true,
    },
    {
      onConflict: 'user_id',
    }
  )

  return { error: error?.message ?? null }
}

/**
 * Update the last_sync timestamp after a successful import
 */
export async function updateLastSync(
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('email_connections')
    .update({ last_sync: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_active', true)

  return { error: error?.message ?? null }
}

/**
 * Deactivate an email connection (soft delete)
 */
export async function deactivateEmailConnection(
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('email_connections')
    .update({ is_active: false })
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

/**
 * Delete an email connection permanently
 */
export async function deleteEmailConnection(
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('email_connections')
    .delete()
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

/**
 * Check if a token is expired (with 5-minute buffer)
 */
export function isTokenExpired(connection: EmailConnectionRow): boolean {
  if (!connection.token_expires_at) {
    return false // No expiry means it doesn't expire (unlikely but safe default)
  }

  const expiresAt = new Date(connection.token_expires_at)
  const bufferMs = 5 * 60 * 1000 // 5 minutes
  return Date.now() >= expiresAt.getTime() - bufferMs
}
