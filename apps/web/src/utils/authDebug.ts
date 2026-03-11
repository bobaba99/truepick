type DebuggableSession = {
  user?: {
    id?: string
    email?: string | null
    is_anonymous?: boolean
    app_metadata?: {
      provider?: string
    }
  }
} | null

const SENSITIVE_AUTH_KEYS = new Set([
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
  'code',
])

export const redactAuthParamValue = (key: string, value: string) =>
  SENSITIVE_AUTH_KEYS.has(key)
    ? `[redacted:${value.length}]`
    : value

const summarizeSearchParams = (params: URLSearchParams) =>
  Object.fromEntries(
    [...params.entries()].map(([key, value]) => [key, redactAuthParamValue(key, value)]),
  )

export const summarizeAuthLocation = (href: string) => {
  const url = new URL(href)
  const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)

  return {
    origin: url.origin,
    path: url.pathname,
    searchParams: summarizeSearchParams(url.searchParams),
    hashParams: summarizeSearchParams(hashParams),
  }
}

export const summarizeSessionDebug = (session: DebuggableSession) => {
  if (!session?.user) return null

  return {
    userId: session.user.id ?? null,
    email: session.user.email ?? null,
    isAnonymous: session.user.is_anonymous ?? false,
    provider: session.user.app_metadata?.provider ?? null,
  }
}

export const summarizeErrorDebug = (error: unknown) => {
  if (!error || typeof error !== 'object') return null

  const candidate = error as Record<string, unknown>

  return {
    message: typeof candidate.message === 'string' ? candidate.message : null,
    code: typeof candidate.code === 'string' ? candidate.code : null,
    details: typeof candidate.details === 'string' ? candidate.details : null,
    hint: typeof candidate.hint === 'string' ? candidate.hint : null,
  }
}

export const isAuthDebugEnabled = () => {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true

  try {
    return (
      window.location.search.includes('auth_debug=1') ||
      window.localStorage.getItem('tp:auth-debug') === '1'
    )
  } catch {
    return false
  }
}

export const logAuthDebug = (
  label: string,
  payload?: Record<string, unknown> | null,
  level: 'log' | 'warn' | 'error' = 'log',
) => {
  if (!isAuthDebugEnabled()) return

  console[level](`[auth-debug] ${label}`, payload ?? {})
}
