import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase } from './api/supabaseClient'
import Dashboard from './pages/Dashboard'
import Swipe from './pages/Swipe'
import Profile from './pages/Profile'
import Resources from './pages/Resources'
import ResourceDetail from './pages/ResourceDetail'
import AdminResources from './pages/AdminResources'
import About from './pages/About'
import Support from './pages/Support'
import FAQ from './pages/FAQ'
import Contact from './pages/Contact'
import HowItWorks from './pages/HowItWorks'
import EmailSync from './pages/EmailSync'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import './styles/App.css'
import { CustomCursor, useGSAPLoader, LiquidButton, VolumetricInput } from './components/Kinematics'

type AuthMode = 'sign_in' | 'sign_up'

type StatusMessage = {
  type: 'error' | 'success' | 'info'
  message: string
}

const hasSupabaseConfig =
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
const configuredAdminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((value: string) => value.trim().toLowerCase())
  .filter((value: string) => value.length > 0)

const syncUserRecord = async (activeSession: Session) => {
  const email = activeSession.user.email
  if (!email) {
    return
  }

  const { error } = await supabase.from('users').upsert(
    {
      id: activeSession.user.id,
      email,
      last_active: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) {
    console.error('Failed to sync user record', error)
  }
}

function RequireAuth({ session }: { session: Session | null }) {
  if (!session) {
    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}

function PublicOnly({ children }: { session: Session | null; children: React.ReactNode }) {
  return children
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
  onAuth,
  onEmailChange,
  onPasswordChange,
  onToggleMode,
}: {
  session: Session | null
  authMode: AuthMode
  headline: string
  status: StatusMessage | null
  loading: boolean
  email: string
  password: string
  onAuth: (event: React.FormEvent<HTMLFormElement>) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onToggleMode: () => void
}) {
  const navigate = useNavigate()

  return (
    <section className="auth-layout">
      <section className="hero">
        <span className="badge">Regret-based purchase reflection</span>
        <h1>{headline}</h1>
        <p>
          Nopamine turns regret into a signal. Import purchases, swipe your
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
          <h2>{session ? 'You are signed in' : 'Sign in to continue'}</h2>
          <p>
            {session
              ? 'Continue to your profile to see your latest data.'
              : 'Use the same email you will connect for receipt ingestion.'}
          </p>
        </div>

        {!hasSupabaseConfig && (
          <div className="status error">
            Missing Supabase config. Add VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY to your Vite environment.
          </div>
        )}

        {status && (
          <div className={`status ${status.type}`}>{status.message}</div>
        )}

        {session ? (
          <div className="signed-in">
            <div>
              <span className="label">Signed in as </span>
              <span className="value">{session.user.email}</span>
            </div>
            <LiquidButton
              className="primary"
              type="button"
              onClick={() => navigate('/profile')}
            >
              Continue
            </LiquidButton>
          </div>
        ) : (
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
            <LiquidButton className="primary" type="submit" disabled={loading}>
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
  const gsapLoaded = useGSAPLoader()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      return
    }

    void syncUserRecord(session)
  }, [session])

  const headline = useMemo(() => {
    if (session) {
      return 'Your regret mirror is ready.'
    }

    return authMode === 'sign_in'
      ? 'Welcome back. Keep your future self honest.'
      : 'Create your regret mirror. No judgement, just clarity.'
  }, [authMode, session])
  const isAdminUser = useMemo(() => {
    const email = session?.user.email?.toLowerCase()
    if (!email) {
      return false
    }
    return configuredAdminEmails.includes(email)
  }, [session])

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)

    if (!hasSupabaseConfig) {
      setStatus({
        type: 'error',
        message:
          'Supabase environment variables are missing. Add them before trying to sign in.',
      })
      return
    }

    setLoading(true)

    const action =
      authMode === 'sign_in'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })

    const { data, error } = await action

    if (error) {
      setStatus({ type: 'error', message: error.message })
      setLoading(false)
      return
    }

    if (authMode === 'sign_up' && !data.session) {
      setStatus({
        type: 'success',
        message:
          'Check your inbox to confirm your account, then sign in with your password.',
      })
    } else {
      setStatus({
        type: 'success',
        message: authMode === 'sign_in' ? 'Signed in.' : 'Account created.',
      })
    }

    setLoading(false)
  }

  const handleSignOut = async () => {
    setLoading(true)
    setStatus(null)
    const { error } = await supabase.auth.signOut()

    if (error) {
      setStatus({ type: 'error', message: error.message })
    } else {
      setStatus({ type: 'info', message: 'Signed out.' })
    }

    setLoading(false)
  }

  return (
    <BrowserRouter>
      <div className="page">
        {gsapLoaded && <CustomCursor />}
        <header className="topbar">
          <div className="brand">Nopamine</div>
          <nav className="nav topbar-nav">
            {session && (
              <NavLink to="/" end className="nav-link">
                Dashboard
              </NavLink>
            )}
            {session && (
              <NavLink to="/swipe" className="nav-link">
                Swipe
              </NavLink>
            )}
            {session && (
              <NavLink to="/profile" className="nav-link">
                Profile
              </NavLink>
            )}
            {session && isAdminUser && (
              <NavLink to="/admin/resources" className="nav-link">
                Admin
              </NavLink>
            )}
            <NavLink to="/resources" className="nav-link">
              Resources
            </NavLink>
            <NavLink to="/about" className="nav-link">
              About
            </NavLink>
            <NavLink to="/support" className="nav-link">
              Support
            </NavLink>
          </nav>
          <div className="top-actions">
            {session ? (
              <div className="session-chip">
                <span className="session-label">Signed in</span>
                <span className="session-email">{session.user.email}</span>
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
            ) : (
              <span className="hint">Start with email + password</span>
            )}
          </div>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
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
                    onAuth={handleAuth}
                    onEmailChange={setEmail}
                    onPasswordChange={setPassword}
                    onToggleMode={() =>
                      setAuthMode(authMode === 'sign_in' ? 'sign_up' : 'sign_in')
                    }
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
              <Route path="/email-sync" element={<EmailSync />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
            </Route>

            <Route element={<RequireAuth session={session} />}>
              <Route
                element={
                  session ? (
                    <AppShell />
                  ) : null
                }
              >
                <Route index element={<Dashboard session={session} />} />
                <Route path="swipe" element={<Swipe session={session} />} />
                <Route path="profile" element={<Profile session={session} />} />
                <Route
                  path="admin/resources"
                  element={
                    isAdminUser
                      ? <AdminResources session={session} />
                      : <Navigate to="/" replace />
                  }
                />
              </Route>
            </Route>

            <Route
              path="*"
              element={<Navigate to={session ? '/' : '/auth'} replace />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
