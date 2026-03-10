import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { GlassCard, LiquidButton, VolumetricInput } from '../components/Kinematics'
import { analytics } from '../hooks/useAnalytics'
import './Landing.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

type LandingProps = {
  session: Session | null
}

export default function Landing({ session }: LandingProps) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSignedIn = session && !session.user.is_anonymous

  const handleWaitlistSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), verdicts_at_signup: 0 }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Something went wrong. Please try again.')
        return
      }

      analytics.trackWaitlistSubmitted('landing_page')
      setSubmitted(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="landing">
      {/* ── Hero ── */}
      <div className="landing-hero">
        <span className="landing-badge">AI-powered purchase decisions</span>
        <h1 className="landing-headline">
          Stop paying the impulse tax.
        </h1>
        <p className="landing-subheadline">
          TruePick is your purchase decision therapist. Submit any product, get an
          instant AI verdict — Buy, Hold, or Skip — personalized to your values and
          spending patterns.
        </p>
        <div className="landing-hero-actions">
          {isSignedIn ? (
            <LiquidButton as={Link} to="/dashboard" className="landing-hero-action landing-hero-cta">
              Go to Dashboard
            </LiquidButton>
          ) : (
            <LiquidButton
              as={Link}
              to="/dashboard"
              className="landing-hero-action landing-hero-cta"
              onClick={() => analytics.trackLandingCtaClicked('hero_try_verdict')}
            >
              Try a free verdict
            </LiquidButton>
          )}
          <LiquidButton
            className="landing-hero-action landing-hero-secondary"
            type="button"
            onClick={() => {
              document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            See how it works
          </LiquidButton>
        </div>
      </div>

      {/* ── How It Works ── */}
      <div className="landing-section" id="how-it-works">
        <h2 className="landing-section-title">How It Works</h2>
        <p className="landing-section-subtitle">
          Three steps between you and buyer&apos;s remorse.
        </p>

        <div className="landing-steps">
          <GlassCard className="landing-step-card">
            <div className="landing-step-number">1</div>
            <h3>Submit your purchase</h3>
            <p>Enter the product name, price, and why you want it. Takes 30 seconds.</p>
          </GlassCard>

          <GlassCard className="landing-step-card">
            <div className="landing-step-number">2</div>
            <h3>Get your verdict</h3>
            <p>Our AI evaluates impulse indicators, value alignment, and your spending history.</p>
          </GlassCard>

          <GlassCard className="landing-step-card">
            <div className="landing-step-number">3</div>
            <h3>Decide with clarity</h3>
            <p>A clear Buy, Hold, or Skip recommendation with transparent reasoning you can trust.</p>
          </GlassCard>
        </div>
      </div>

      {/* ── Psychology Stats ── */}
      <div className="landing-section landing-stats-section">
        <h2 className="landing-section-title">The Psychology of Regret</h2>
        <p className="landing-section-subtitle">
          Purchase regret is universal — and preventable.
        </p>

        <div className="landing-stats">
          <GlassCard className="landing-stat-card">
            <span className="landing-stat-value">$3,400</span>
            <span className="landing-stat-label">spent on impulse buys per person, per year</span>
          </GlassCard>

          <GlassCard className="landing-stat-card">
            <span className="landing-stat-value">90%</span>
            <span className="landing-stat-label">of Gen Z and Millennials report impulse buying</span>
          </GlassCard>

          <GlassCard className="landing-stat-card">
            <span className="landing-stat-value">44%</span>
            <span className="landing-stat-label">of Americans are considering no-buy challenges</span>
          </GlassCard>
        </div>

        <p className="landing-stats-source">
          TruePick intervenes at the moment of deliberation — not after the regret sets in.
        </p>
      </div>

      {/* ── Premium Waitlist ── */}
      <div className="landing-section landing-waitlist-section" id="waitlist">
        <GlassCard className="landing-waitlist-card">
          <h2 className="landing-section-title">Premium is coming</h2>
          <p className="landing-waitlist-body">
            Weekly spending pattern reports, Chrome extension, personalized alternative suggestions,
            ongoing email sync, and app-blocking during hold periods. Founding
            members get <strong>3 months free</strong>.
          </p>

          {submitted ? (
            <p className="landing-waitlist-success">
              You&apos;re on the list! We&apos;ll reach out when premium launches.
            </p>
          ) : (
            <form className="landing-waitlist-form" onSubmit={(e) => void handleWaitlistSubmit(e)}>
              <div className="landing-waitlist-input-row">
                <VolumetricInput
                  as="input"
                  type="email"
                  className="landing-waitlist-input"
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  required
                  aria-label="Email address for premium waitlist"
                />
                <LiquidButton type="submit" className="primary landing-waitlist-btn" disabled={submitting}>
                  {submitting ? 'Joining...' : 'Join waitlist'}
                </LiquidButton>
              </div>
              {error && <p className="landing-waitlist-error">{error}</p>}
            </form>
          )}
        </GlassCard>
      </div>

      {/* ── Footer CTA ── */}
      <div className="landing-section landing-footer-cta">
        <h2 className="landing-footer-heading">
          Your future self will thank you.
        </h2>
        <p className="landing-footer-body">
          No account required. Get your first verdict in under 60 seconds.
        </p>
        {isSignedIn ? (
          <LiquidButton as={Link} to="/dashboard" className="landing-hero-cta">
            Go to Dashboard
          </LiquidButton>
        ) : (
          <LiquidButton
            as={Link}
            to="/dashboard"
            className="landing-hero-cta"
            onClick={() => analytics.trackLandingCtaClicked('footer_try_verdict')}
          >
            Get your free verdict
          </LiquidButton>
        )}
      </div>

      {/* ── Site footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-links">
          <Link to="/about">About</Link>
          <Link to="/resources">Resources</Link>
          <Link to="/how-it-works">How It Works</Link>
          <Link to="/premium">Premium</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/support">Support</Link>
        </div>
        <p className="landing-footer-copy">
          &copy; {new Date().getFullYear()} TruePick. All rights reserved.
        </p>
      </footer>
    </section>
  )
}
