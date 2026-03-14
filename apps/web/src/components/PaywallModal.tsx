import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useModalAnimation } from './Kinematics'
import { analytics } from '../hooks/useAnalytics'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

type PaywallModalProps = {
  isOpen: boolean
  onClose: () => void
  onSignUp: () => void
  verdictsUsedToday: number
  dailyLimit: number
  isAnonymous: boolean
}

export default function PaywallModal({
  isOpen,
  onClose,
  onSignUp,
  verdictsUsedToday,
  dailyLimit,
  isAnonymous,
}: PaywallModalProps) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { shouldRender, backdropRef, contentRef } = useModalAnimation(isOpen)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!shouldRender) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const handleWaitlistSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    setError(null)

    analytics.trackPaywallConversionStarted({
      trigger_context: 'paywall_modal',
      verdicts_at_conversion: verdictsUsedToday,
    })

    try {
      const response = await fetch(`${API_BASE}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), verdicts_at_signup: verdictsUsedToday }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Something went wrong. Please try again.')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Daily limit reached"
      onClick={handleBackdropClick}
    >
      <div ref={contentRef} className="paywall-modal">
        <button
          type="button"
          className="paywall-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>

        <div className="paywall-modal-body">
          <h2 className="paywall-modal-heading">
            You&apos;ve used your {dailyLimit} free verdicts today
          </h2>
          <p className="paywall-modal-subtext">
            Join the premium waitlist now — founding members get 3 months free.
          </p>

          {submitted ? (
            <p className="paywall-modal-success">
              You&apos;re on the list! We&apos;ll reach out soon.
            </p>
          ) : (
            <form className="paywall-waitlist-form" onSubmit={(e) => void handleWaitlistSubmit(e)}>
              <input
                ref={inputRef}
                type="email"
                className="paywall-email-input"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email address"
              />
              {error && <p className="paywall-modal-error">{error}</p>}
              <button
                type="submit"
                className="paywall-cta-btn"
                disabled={submitting}
              >
                {submitting ? 'Joining...' : 'Join waitlist'}
              </button>
            </form>
          )}

          {isAnonymous && (
            <button
              type="button"
              className="paywall-signup-link"
              onClick={onSignUp}
            >
              Or sign up free to carry over your verdicts
            </button>
          )}

          <Link
            to="/premium"
            className="paywall-signup-link"
            onClick={onClose}
          >
            Learn more about Premium
          </Link>
        </div>
      </div>
    </div>
  )
}
