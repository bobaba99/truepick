import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './api/core/supabaseClient'
import Dashboard from './pages/Dashboard'
import Swipe from './pages/Swipe'
import Profile from './pages/Profile'
import Resources from './pages/Resources'
import ResourceDetail from './pages/ResourceDetail'
import AdminResources from './pages/AdminResources'
import Landing from './pages/Landing'
import About from './pages/About'
import Support from './pages/Support'
import FAQ from './pages/FAQ'
import Contact from './pages/Contact'
import HowItWorks from './pages/HowItWorks'
import EmailSync from './pages/EmailSync'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Premium from './pages/Premium'
import SharedVerdict from './pages/SharedVerdict'
import './styles/App.css'
import { CustomCursor, LiquidButton, VolumetricInput } from './components/Kinematics'
import { UserPreferencesProvider } from './preferences/UserPreferencesContext'
import AnalyticsProvider from './components/AnalyticsProvider'
import { analytics } from './hooks/useAnalytics'
import {
  buildOAuthRedirectUrl,
  extractAuthCallbackError,
  hasAuthCallbackParams,
  shouldWaitForAuthSession,
} from './utils/authFlow'
import {
  logAuthDebug,
  summarizeErrorDebug,
  summarizeAuthLocation,
  summarizeSessionDebug,
} from './utils/authDebug'
import { hasSupabaseBrowserConfig } from './utils/supabaseEnv'

type AuthMode = 'sign_in' | 'sign_up'

type StatusMessage = {
  type: 'error' | 'success' | 'info'
  message: string
}

const providerLabels: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
  email: 'Email',
}

const formatProviderName = (provider: string) =>
  providerLabels[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1)

const formatProviderList = (providers: string[]) =>
  providers.map(formatProviderName).join(', ')

const hasSupabaseConfig = hasSupabaseBrowserConfig(import.meta.env)
const configuredAdminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value: string) => value.trim().toLowerCase())
  .filter((value: string) => value.length > 0)

const syncUserRecord = async (activeSession: Session) => {
  const email = activeSession.user.email ?? null

  const { error } = await supabase.from('users').upsert(
    {
      id: activeSession.user.id,
      email,
      last_active: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) {
      logAuthDebug('syncUserRecord failed', {
        session: summarizeSessionDebug(activeSession),
        error: summarizeErrorDebug(error),
    }, 'error')
  }
}

function RequireAuth({ session }: { session: Session | null }) {
  if (!session) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}

function PublicOnly({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (session && !session.user.is_anonymous) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function OAuthRedirector({
  shouldRedirect,
  onRedirected,
}: {
  shouldRedirect: boolean
  onRedirected: () => void
}) {
  const navigate = useNavigate()

  useEffect(() => {
    if (shouldRedirect) {
      onRedirected()
      navigate('/dashboard', { replace: true })
    }
  }, [shouldRedirect, navigate, onRedirected])

  return null
}

function AppShell() {
  return (
    <div className="app-shell">
      <div className="route-surface">
        <Outlet />
      </div>
    </div>
  )
}

function AuthRoute({
  session,
  authMode,
  headline,
  status,
  loading,
  email,
  password,
  guestLoading,
  googleLoading,
  appleLoading,
  linkedProviders,
  onAuth,
  onEmailChange,
  onPasswordChange,
  onToggleMode,
  onSetMode,
  onGuestContinue,
  onGoogleSignIn,
  onAppleSignIn,
}: {
  session: Session | null
  authMode: AuthMode
  headline: string
  status: StatusMessage | null
  loading: boolean
  email: string
  password: string
  guestLoading: boolean
  googleLoading: boolean
  appleLoading: boolean
  linkedProviders: string[]
  onAuth: (event: React.FormEvent<HTMLFormElement>) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onToggleMode: () => void
  onSetMode: (mode: AuthMode) => void
  onGuestContinue: () => Promise<boolean>
  onGoogleSignIn: () => void
  onAppleSignIn: () => void
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Sync auth mode from ?mode=sign_up or ?mode=sign_in query param
  useEffect(() => {
    const modeParam = searchParams.get('mode')
    if (modeParam === 'sign_up' || modeParam === 'sign_in') {
      onSetMode(modeParam)
    }
  }, [searchParams, onSetMode])

  return (
    <section className="auth-layout">
      <section className="hero">
        <span className="badge">Regret-based purchase reflection</span>
        <h1>{headline}</h1>
        <p>
          TruePick turns regret into a signal. Import purchases, swipe your
          feelings, and slow down the next impulse buy with a 24-hour hold.
        </p>
        <div className="pill-row">
          <span>Swipe regret vs satisfied</span>
          <span>Personal patterns, not budgeting</span>
          <span>Designed for fast honesty</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="card-header">
          <h2>{session && !session.user.is_anonymous
            ? 'You are signed in'
            : authMode === 'sign_up'
              ? 'Create your account'
              : 'Sign in to continue'}</h2>
          <p>
            {session && !session.user.is_anonymous
              ? 'Continue to your profile to see your latest data.'
              : 'Use the same email you will connect for receipt ingestion.'}
          </p>
        </div>

        {!hasSupabaseConfig && (
          <div className="status error">
            Missing Supabase config. Add `VITE_SUPABASE_URL` and either
            `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` to your
            Vite environment.
          </div>
        )}

        {status && (
          <div className={`status ${status.type}`}>{status.message}</div>
        )}

        {session && !session.user.is_anonymous ? (
          <div className="signed-in">
            <div>
              <span className="label">Signed in as </span>
              <span className="value">{session.user.email}</span>
            </div>
            {linkedProviders.length > 0 && (
              <div className="linked-providers">
                <span className="linked-providers-label">Linked accounts</span>
                <div className="provider-badges">
                  {linkedProviders.map((provider) => (
                    <span key={provider} className={`provider-badge provider-badge--${provider}`}>
                      {formatProviderName(provider)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <LiquidButton
              className="primary"
              type="button"
              onClick={() => navigate('/profile')}
            >
              Continue
            </LiquidButton>
          </div>
        ) : (
          <>
            <div className="auth-oauth-group">
              <button
                type="button"
                className="auth-oauth-btn auth-oauth-btn--google"
                onClick={onGoogleSignIn}
                disabled={googleLoading || appleLoading || guestLoading || loading}
              >
                <svg className="auth-oauth-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {googleLoading ? 'Redirecting...' : 'Continue with Google'}
              </button>
              <button
                type="button"
                className="auth-oauth-btn auth-oauth-btn--apple"
                onClick={onAppleSignIn}
                disabled={appleLoading || googleLoading || guestLoading || loading}
              >
                <svg className="auth-oauth-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.65-2.2.46-3.06-.4C3.79 16.17 4.36 9.53 8.82 9.28c1.24.06 2.1.7 2.83.73.97-.2 1.9-.77 2.93-.7 1.24.1 2.17.58 2.78 1.5-2.55 1.53-1.95 4.89.58 5.82-.47 1.22-.68 1.77-1.28 2.84-.69 1.23-1.67 2.46-2.88 2.48-.99.02-1.56-.65-2.89-.66-1.33 0-1.95.67-3.02.68-1.24.02-2.18-1.33-2.87-2.57-1.94-3.47-2.14-7.53-.84-9.69.92-1.53 2.37-2.43 3.91-2.43 1.46 0 2.38.66 3.58.66 1.17 0 1.88-.66 3.57-.66 1.37 0 2.64.74 3.51 2.02-3.08 1.69-2.58 6.08.72 7.25zM14.73 3.58c.76-.94 1.3-2.26 1.1-3.58-1.18.08-2.56.83-3.37 1.81-.73.88-1.34 2.21-1.1 3.5 1.29.04 2.61-.72 3.37-1.73z" fill="currentColor" />
                </svg>
                {appleLoading ? 'Redirecting...' : 'Continue with Apple'}
              </button>
            </div>
            <div className="auth-divider"><span>or</span></div>
            <form className="auth-form" onSubmit={onAuth}>
              <label>
                Email
                <VolumetricInput
                  as="input"
                  autoComplete="email"
                  value={email}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => onEmailChange(event.target.value)}
                  placeholder="you@domain.com"
                  required
                />
              </label>
              <label>
                Password
                <VolumetricInput
                  as="input"
                  type="password"
                  autoComplete={
                    authMode === 'sign_in' ? 'current-password' : 'new-password'
                  }
                  value={password}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => onPasswordChange(event.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </label>
              <LiquidButton className="primary" type="submit" disabled={loading || guestLoading}>
                {loading
                  ? 'Working...'
                  : authMode === 'sign_in'
                    ? 'Sign in'
                    : 'Create account'}
              </LiquidButton>
              <LiquidButton className="link" type="button" onClick={onToggleMode}>
                {authMode === 'sign_in'
                  ? 'Need an account? Sign up'
                  : 'Already have an account? Sign in'}
              </LiquidButton>
            </form>
            {authMode === 'sign_in' && (
              <>
                <div className="auth-divider"><span>or</span></div>
                <LiquidButton
                  className="ghost auth-guest-btn"
                  type="button"
                  disabled={guestLoading || googleLoading || appleLoading || loading}
                  onClick={async () => {
                    const canContinue = await onGuestContinue()
                    if (!canContinue) return
                    navigate('/dashboard')
                  }}
                >
                  {guestLoading ? 'Continuing...' : 'Continue as guest'}
                </LiquidButton>
              </>
            )}
          </>
        )}
      </section>
    </section>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authMode, setAuthMode] = useState<AuthMode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [oAuthJustCompleted, setOAuthJustCompleted] = useState(false)
  const handleOAuthRedirected = useCallback(() => setOAuthJustCompleted(false), [])
  const [headerHidden, setHeaderHidden] = useState(false)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const [authToast, setAuthToast] = useState<string | null>(null)
  const authToastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const previousProviders = useRef<string[]>([])
  const lastScrollY = useRef(0)

  const showAuthToast = useCallback((message: string) => {
    if (authToastTimeout.current) clearTimeout(authToastTimeout.current)
    setAuthToast(message)
    authToastTimeout.current = setTimeout(() => setAuthToast(null), 4000)
  }, [])

  const handleScroll = useCallback(() => {
    const currentY = window.scrollY
    setHeaderScrolled(currentY > 20)
    // Keep nav bar always visible on public marketing pages
    if (window.location.pathname === '/' || window.location.pathname === '/premium') {
      setHeaderHidden(false)
      lastScrollY.current = currentY
      return
    }
    const shouldHide = currentY > lastScrollY.current && currentY > 80
    setHeaderHidden((prev) => (prev === shouldHide ? prev : shouldHide))
    lastScrollY.current = currentY
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    const hasAuthCallback = hasAuthCallbackParams(window.location.hash, window.location.search)
    const authCallbackError = extractAuthCallbackError(window.location.hash, window.location.search)

    logAuthDebug('auth bootstrap', {
      hasSupabaseConfig,
      hasAuthCallback,
      authCallbackError,
      location: summarizeAuthLocation(window.location.href),
    })

    if (authCallbackError) {
      logAuthDebug('auth callback error detected in URL', {
        authCallbackError,
        location: summarizeAuthLocation(window.location.href),
      }, 'warn')
      setStatus({
        type: 'error',
        message: `OAuth sign-in failed: ${authCallbackError}`,
      })
    }

    // Safety timeout: if OAuth hash is present but SIGNED_IN never fires (e.g.
    // expired token, network error), stop the loading spinner after 5 seconds.
    let oauthTimeout: ReturnType<typeof setTimeout> | undefined
    if (hasAuthCallback && !authCallbackError) {
      oauthTimeout = setTimeout(() => {
        logAuthDebug('oauth timeout waiting for session', {
          location: summarizeAuthLocation(window.location.href),
          currentSession: summarizeSessionDebug(session),
        }, 'warn')
        setStatus((current) => current ?? {
          type: 'error',
          message:
            'Sign-in finished at the provider, but TruePick did not receive a session. Check your Supabase redirect URLs and try again.',
        })
        setSessionLoading(false)
      }, 5000)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      logAuthDebug('onAuthStateChange', {
        event,
        session: summarizeSessionDebug(nextSession),
        location: summarizeAuthLocation(window.location.href),
      })
      setSession(nextSession)
      // After OAuth redirect, the SIGNED_IN event means the hash was consumed.
      if (hasAuthCallback && event === 'SIGNED_IN') {
        if (oauthTimeout) clearTimeout(oauthTimeout)
        setOAuthJustCompleted(true)
        setSessionLoading(false)
      }

      if (event === 'SIGNED_IN' && nextSession) {
        const provider = nextSession.user.app_metadata.provider
        if (provider === 'google') analytics.trackLogin('google')
        if (provider === 'apple') analytics.trackLogin('apple')

        // Detect identity linking: compare current providers with previous snapshot
        const currentProviders: string[] = nextSession.user.app_metadata.providers ?? []
        const prev = previousProviders.current
        if (prev.length > 0 && currentProviders.length > prev.length) {
          const newlyLinked = currentProviders.filter((p) => !prev.includes(p))
          if (newlyLinked.length > 0) {
            const linked = newlyLinked.map(formatProviderName).join(', ')
            const all = formatProviderList(currentProviders)
            showAuthToast(`${linked} linked! You can now sign in with ${all}.`)
          }
        }
        previousProviders.current = currentProviders
      }
    })

    supabase.auth.getSession().then(async ({ data }) => {
      logAuthDebug('getSession resolved', {
        session: summarizeSessionDebug(data.session),
        hasAuthCallback,
        authCallbackError,
      })
      if (data.session) {
        setSession(data.session)
        previousProviders.current = data.session.user.app_metadata.providers ?? []
        if (!shouldWaitForAuthSession(
          hasAuthCallback,
          data.session.user.is_anonymous ?? false,
          Boolean(authCallbackError),
        )) {
          if (oauthTimeout) clearTimeout(oauthTimeout)
          setSessionLoading(false)
        }
      } else if (!hasAuthCallback) {
        // No session and no OAuth callback — attempt anonymous sign-in so guests
        // get a real user_id. Falls through gracefully when disabled on the project.
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
      logAuthDebug('bootstrap anonymous sign-in result', {
        session: summarizeSessionDebug(anonData.session),
        error: summarizeErrorDebug(anonError),
      }, anonError ? 'warn' : 'log')
        if (!anonError && anonData.session) {
          setSession(anonData.session)
        } else if (anonError && window.location.pathname === '/auth') {
          setStatus({
            type: 'info',
            message: 'Guest mode is unavailable right now. You can still sign up with email, Google, or Apple.',
          })
        }
        setSessionLoading(false)
      } else if (authCallbackError) {
        setSessionLoading(false)
      }
      // When an auth callback is present and no resolved session exists,
      // until onAuthStateChange fires SIGNED_IN above (or the safety timeout).
    })

    return () => {
      subscription.unsubscribe()
      if (oauthTimeout) clearTimeout(oauthTimeout)
    }
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    void syncUserRecord(session)
  }, [session])

  const isSignedIn = session && !session.user.is_anonymous
  const isAppUser = Boolean(session)
  const linkedProviders: string[] = session?.user.app_metadata.providers ?? []

  const headline = useMemo(() => {
    if (isSignedIn) {
      return 'Your regret mirror is ready.'
    }

    return authMode === 'sign_in'
      ? 'Welcome back. Keep your future self honest.'
      : 'Create your regret mirror. No judgement, just clarity.'
  }, [authMode, isSignedIn])
  const isAdminUser = useMemo(() => {
    const email = session?.user.email?.toLowerCase()
    if (!email) {
      return false
    }
    return configuredAdminEmails.includes(email)
  }, [session])

  const selectAuthAction = (mode: AuthMode, isAnonymous: boolean) => {
    if (mode === 'sign_in') return supabase.auth.signInWithPassword({ email, password })
    if (isAnonymous) return supabase.auth.updateUser({ email, password }) // converts anonymous → permanent
    return supabase.auth.signUp({ email, password }) // fresh sign-up
  }

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)

    if (!hasSupabaseConfig) {
      setStatus({
        type: 'error',
        message:
          'Supabase environment variables are missing. Add the project URL and a browser auth key before trying to sign in.',
      })
      return
    }

    setLoading(true)

    const isAnonymous = session?.user.is_anonymous ?? false
    logAuthDebug('email auth submit', {
      mode: authMode,
      isAnonymous,
      hasEmail: Boolean(email),
      emailDomain: email.includes('@') ? email.split('@')[1] : null,
      session: summarizeSessionDebug(session),
    })
    const action = selectAuthAction(authMode, isAnonymous)

    const { data, error } = await action

    if (error) {
      logAuthDebug('email auth failed', {
        mode: authMode,
        error: summarizeErrorDebug(error),
      }, 'error')
      setStatus({ type: 'error', message: error.message })
      setLoading(false)
      return
    }

    logAuthDebug('email auth succeeded', {
      mode: authMode,
      session: summarizeSessionDebug('session' in data ? data.session : null),
    })

    const isAnonymousConversion = authMode === 'sign_up' && isAnonymous
    const resultSession = 'session' in data ? data.session : null

    if (authMode === 'sign_up' && !resultSession && !isAnonymousConversion) {
      // Fresh sign-up without immediate session — email confirmation required
      setStatus({
        type: 'success',
        message:
          'Check your inbox to confirm your account, then sign in with your password.',
      })
    } else {
      if (authMode === 'sign_up') {
        analytics.trackSignUp()
        if (isAnonymousConversion) {
          // Anonymous → permanent: session is already live via onAuthStateChange
          void syncUserRecord(session!)
        } else if (resultSession) {
          void syncUserRecord(resultSession)
        }
      } else {
        analytics.trackLogin()
      }
      setStatus({
        type: 'success',
        message: authMode === 'sign_in' ? 'Signed in.' : 'Account created.',
      })
    }

    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    if (!hasSupabaseConfig) {
      setStatus({
        type: 'error',
        message:
          'Supabase environment variables are missing. Add the project URL and a browser auth key before trying to sign in.',
      })
      return
    }

    setGoogleLoading(true)
    setStatus(null)
    logAuthDebug('starting google oauth', {
      redirectTo: buildOAuthRedirectUrl(window.location.origin),
      location: summarizeAuthLocation(window.location.href),
      session: summarizeSessionDebug(session),
    })

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildOAuthRedirectUrl(window.location.origin),
      },
    })

    if (error) {
      logAuthDebug('google oauth start failed', {
        error: summarizeErrorDebug(error),
      }, 'error')
      setStatus({ type: 'error', message: error.message })
      setGoogleLoading(false)
    }
  }

  const handleAppleSignIn = async () => {
    if (!hasSupabaseConfig) {
      setStatus({
        type: 'error',
        message:
          'Supabase environment variables are missing. Add the project URL and a browser auth key before trying to sign in.',
      })
      return
    }

    setAppleLoading(true)
    setStatus(null)
    logAuthDebug('starting apple oauth', {
      redirectTo: buildOAuthRedirectUrl(window.location.origin),
      location: summarizeAuthLocation(window.location.href),
      session: summarizeSessionDebug(session),
    })

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: buildOAuthRedirectUrl(window.location.origin),
      },
    })

    if (error) {
      logAuthDebug('apple oauth start failed', {
        error: summarizeErrorDebug(error),
      }, 'error')
      setStatus({ type: 'error', message: error.message })
      setAppleLoading(false)
    }
  }

  const handleGuestContinue = async () => {
    analytics.trackGuestContinued()
    logAuthDebug('guest continue clicked', {
      session: summarizeSessionDebug(session),
      location: summarizeAuthLocation(window.location.href),
    })

    if (session) {
      return true
    }

    setGuestLoading(true)
    setStatus(null)

    const { data, error } = await supabase.auth.signInAnonymously()
    logAuthDebug('guest anonymous sign-in result', {
      session: summarizeSessionDebug(data.session),
      error: summarizeErrorDebug(error),
    }, error ? 'warn' : 'log')

    if (error || !data.session) {
      setStatus({
        type: 'error',
        message:
          error?.message ??
          'Guest sign-in is unavailable right now. Check Supabase anonymous auth and try again.',
      })
      setGuestLoading(false)
      return false
    }

    setSession(data.session)
    setGuestLoading(false)
    return true
  }

  const handleSignOut = async () => {
    setLoading(true)
    setStatus(null)
    const { error } = await supabase.auth.signOut()

    if (error) {
      setStatus({ type: 'error', message: error.message })
    } else {
      analytics.trackSignOut()
      setStatus({ type: 'info', message: 'Signed out.' })
    }

    setLoading(false)
  }

  return (
    <BrowserRouter>
      <OAuthRedirector
        shouldRedirect={oAuthJustCompleted}
        onRedirected={handleOAuthRedirected}
      />
      <AnalyticsProvider session={session} sessionLoading={sessionLoading}>
      <UserPreferencesProvider session={session}>
        <div className="page">
          <CustomCursor />
          <header className={`topbar${headerScrolled ? ' topbar--scrolled' : ''}${headerHidden && !mobileMenuOpen ? ' topbar--hidden' : ''}`}>
            <Link to="/" className="brand">TruePick</Link>
            <nav className={`nav topbar-nav${mobileMenuOpen ? ' mobile-open' : ''}`}>
              {isAppUser ? (
                <>
                  <NavLink to="/dashboard" end className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                    Dashboard
                  </NavLink>
                  <NavLink to="/swipe" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                    Swipe
                  </NavLink>
                  <NavLink to="/profile" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                    Profile
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/" end className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                    Home
                  </NavLink>
                  <NavLink to="/how-it-works" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                    How It Works
                  </NavLink>
                  <NavLink to="/premium" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                    Premium
                  </NavLink>
                </>
              )}
              <NavLink to="/resources" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                Resources
              </NavLink>
              <NavLink to="/about" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                About
              </NavLink>
              <NavLink to="/support" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                Support
              </NavLink>
              {session && isAdminUser && (
                <NavLink to="/admin/resources" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                  Admin
                </NavLink>
              )}
            </nav>
            <div className="top-actions">
              {session ? (
                <>
                  <div className="session-chip session-chip--desktop">
                    <span className="session-label">{isSignedIn ? 'Signed in' : 'Guest'}</span>
                    <span className="session-email">{session.user.email ?? 'Guest'}</span>
                    <LiquidButton
                      className="ghost"
                      type="button"
                      onClick={handleSignOut}
                      disabled={loading}
                      data-cursor="expand"
                    >
                      Sign out
                    </LiquidButton>
                  </div>
                  <div className="session-chip session-chip--mobile">
                    <span className="avatar-placeholder" aria-label="User profile">
                      {session.user.email?.charAt(0).toUpperCase() ?? 'G'}
                    </span>
                    <LiquidButton
                      className="ghost"
                      type="button"
                      onClick={handleSignOut}
                      disabled={loading}
                      data-cursor="expand"
                    >
                      Sign out
                    </LiquidButton>
                  </div>
                </>
              ) : (
                <div className="auth-actions">
                  <NavLink
                    to="/auth"
                    className={() =>
                      `auth-action-btn${authMode === 'sign_in' ? ' auth-action-btn--active' : ''}`
                    }
                    onClick={() => {
                      setAuthMode('sign_in')
                      setMobileMenuOpen(false)
                    }}
                  >
                    Sign in
                  </NavLink>
                  <NavLink
                    to="/auth"
                    className={() =>
                      `auth-action-btn auth-action-btn--primary${authMode === 'sign_up' ? ' auth-action-btn--active' : ''}`
                    }
                    onClick={() => {
                      setAuthMode('sign_up')
                      setMobileMenuOpen(false)
                    }}
                    data-cursor="expand"
                  >
                    Sign up
                  </NavLink>
                </div>
              )}
            </div>
            <button
              className="mobile-menu-toggle"
              type="button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => {
                setMobileMenuOpen((open) => {
                  if (!open) analytics.trackNavMenuOpened()
                  return !open
                })
              }}
            >
              <span className={`hamburger${mobileMenuOpen ? ' hamburger--open' : ''}`} />
            </button>
          </header>

          <main className="content">
            {sessionLoading ? (
              <div className="session-loading">
                <div className="eval-spinner" />
              </div>
            ) : (
            <Routes>
              <Route index element={<Landing session={session} />} />
              <Route
                path="/auth"
                element={
                  <PublicOnly session={session}>
                    <AuthRoute
                      session={session}
                      authMode={authMode}
                      headline={headline}
                      status={status}
                      loading={loading}
                      email={email}
                      password={password}
                      guestLoading={guestLoading}
                      googleLoading={googleLoading}
                      appleLoading={appleLoading}
                      linkedProviders={linkedProviders}
                      onAuth={handleAuth}
                      onEmailChange={setEmail}
                      onPasswordChange={setPassword}
                      onToggleMode={() =>
                        setAuthMode(authMode === 'sign_in' ? 'sign_up' : 'sign_in')
                      }
                      onSetMode={setAuthMode}
                      onGuestContinue={handleGuestContinue}
                      onGoogleSignIn={handleGoogleSignIn}
                      onAppleSignIn={handleAppleSignIn}
                    />
                  </PublicOnly>
                }
              />
              <Route element={<AppShell />}>
                <Route path="/resources" element={<Resources />} />
                <Route path="/resources/:slug" element={<ResourceDetail />} />
                <Route path="/about" element={<About />} />
                <Route path="/support" element={<Support />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/contact-us" element={<Contact />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/premium" element={<Premium />} />
                <Route path="/email-sync" element={<EmailSync session={session} />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/shared/:token" element={<SharedVerdict />} />
              </Route>

              <Route element={<RequireAuth session={session} />}>
                <Route element={<AppShell />}>
                  <Route path="dashboard" element={<Dashboard session={session} />} />
                  <Route path="swipe" element={<Swipe session={session} />} />
                  <Route path="profile" element={<Profile session={session} />} />
                  <Route
                    path="admin/resources"
                    element={
                      isAdminUser
                        ? <AdminResources session={session} />
                        : <Navigate to="/dashboard" replace />
                    }
                  />
                </Route>
              </Route>

              <Route
                path="*"
                element={<Navigate to="/" replace />}
              />
            </Routes>
            )}
          </main>
        </div>
      </UserPreferencesProvider>
      </AnalyticsProvider>
      <div className={`auth-toast${authToast ? ' show' : ''}`}>{authToast}</div>
    </BrowserRouter>
  )
}

export default App
