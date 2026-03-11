import type express from 'express'
import { createClient } from '@supabase/supabase-js'
import type { PostHog } from 'posthog-node'
import type { AuthenticatedRequest, AdminRequest } from '../types'

const extractBearerToken = (req: express.Request): string | null => {
  const authHeader = req.headers.authorization
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
}

const validateSupabaseConfig = (
  supabaseUrl: string,
  supabaseServiceKey: string,
  res: express.Response,
): boolean => {
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Server misconfigured: missing Supabase credentials.' })
    return false
  }
  return true
}

export const createRequireAuth = (
  supabaseUrl: string,
  supabaseServiceKey: string,
  posthog: PostHog,
) => {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const token = extractBearerToken(req)
    if (!token) {
      res.status(401).json({ error: 'Missing or invalid Authorization header.' })
      return
    }
    if (!validateSupabaseConfig(supabaseUrl, supabaseServiceKey, res)) return

    const sb = createClient(supabaseUrl, supabaseServiceKey)
    const {
      data: { user },
      error,
    } = await sb.auth.getUser(token)
    if (error || !user?.id) {
      res.status(401).json({ error: 'Invalid or expired token.' })
      return
    }
    ;(req as AuthenticatedRequest).authUser = {
      id: user.id,
      email: user.email ?? '',
    }
    posthog.identify({
      distinctId: user.id,
      properties: { email: user.email ?? '' },
    })
    next()
  }
}

export const createRequireAdmin = (
  supabaseUrl: string,
  supabaseServiceKey: string,
  adminEmails: string[],
) => {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const token = extractBearerToken(req)
    if (!token) {
      res.status(401).json({ error: 'Missing or invalid Authorization header.' })
      return
    }
    if (!validateSupabaseConfig(supabaseUrl, supabaseServiceKey, res)) return

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user?.email) {
      res.status(401).json({ error: 'Invalid or expired token.' })
      return
    }
    if (adminEmails.length > 0 && !adminEmails.includes(user.email.toLowerCase())) {
      res.status(403).json({ error: 'Admin access required.' })
      return
    }
    ;(req as AdminRequest).adminUser = {
      id: user.id,
      email: user.email,
    }
    next()
  }
}

export const createRequireCronSecret = (cronSecret: string) => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!cronSecret) {
      res.status(500).json({ error: 'Server misconfigured: missing hold reminder cron secret.' })
      return
    }

    const token = extractBearerToken(req)
    if (!token || token !== cronSecret) {
      res.status(401).json({ error: 'Invalid scheduler credentials.' })
      return
    }

    next()
  }
}
