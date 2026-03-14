import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import type { Stats, VerdictRow, PurchaseMotivation } from '../api/core/types'
import { PURCHASE_CATEGORIES, PURCHASE_MOTIVATIONS } from '../api/core/types'
import { getSwipeStats } from '../api/purchase/statsService'
import { logger } from '../api/core/logger'
import { sanitizeVerdictRationaleHtml } from '../utils/sanitizeHtml'
import {
  getVerdictHistory,
  evaluatePurchase,
  submitVerdict,
  inputFromVerdict,
  updateVerdictDecision,
  updateVerdictFeedback,
} from '../api/verdict/verdictService'
import VerdictDetailModal from '../components/VerdictDetailModal'
import VerdictShareModal from '../components/VerdictShareModal'
import EvaluatingModal from '../components/EvaluatingModal'
import PaywallModal from '../components/PaywallModal'
import GuestPromptModal from '../components/GuestPromptModal'
import OnboardingTutorial from '../components/onboarding/OnboardingTutorial'
import gsap from 'gsap'
import { GlassCard, LiquidButton, VolumetricInput, SplitText, prefersReducedMotion } from '../components/Kinematics'
import { useUserFormatting, useUserPreferences } from '../preferences/UserPreferencesContext'
import { analytics, bucketPrice } from '../hooks/useAnalytics'
import {
  DAILY_LIMIT,
  JUSTIFICATION_WORD_MIN,
  JUSTIFICATION_WORD_MAX,
  JUSTIFICATION_GUIDANCE_ROTATION_MS,
  JUSTIFICATION_GUIDANCE_FADE_MS,
  JUSTIFICATION_PLACEHOLDERS,
  getNextUtcMidnight,
  countWords,
  formatCountdown,
  outcomeLabel,
} from './dashboard/dashboardConstants'

type DashboardProps = {
  session: Session | null
}

export default function Dashboard({ session }: DashboardProps) {
  const { preferences } = useUserPreferences()
  const { formatCurrency, formatDateTime } = useUserFormatting()

  const navigate = useNavigate()
  const formStartRef = useRef<number | null>(null)
  const formFieldsRef = useRef<Set<string>>(new Set())
  const formSubmittedRef = useRef(false)
  const evalStartRef = useRef<number>(0)
  const regenStartRef = useRef<number>(0)
  const sessionVerdictsCountRef = useRef<number>(0)
  const [stats, setStats] = useState<Stats>({
    swipesCompleted: 0,
    regretRate: 0,
    activeHolds: 0,
  })
  const [recentVerdicts, setRecentVerdicts] = useState<VerdictRow[]>([])
  const [verdictHistoryLoaded, setVerdictHistoryLoaded] = useState(false)
  const [selectedVerdict, setSelectedVerdict] = useState<VerdictRow | null>(null)
  const [shareModalVerdict, setShareModalVerdict] = useState<VerdictRow | null>(null)
  const [verdictSavingId, setVerdictSavingId] = useState<string | null>(null)
  const [verdictRegeneratingId, setVerdictRegeneratingId] = useState<string | null>(null)
  const [expandedRationales, setExpandedRationales] = useState<Set<string>>(new Set())
  const [reflectionExpanded, setReflectionExpanded] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('other')
  const [justification, setJustification] = useState('')
  const [justificationPlaceholderIndex, setJustificationPlaceholderIndex] = useState(0)
  const [isJustificationGuidanceVisible, setIsJustificationGuidanceVisible] = useState(true)
  const [motivation, setMotivation] = useState<PurchaseMotivation | null>(null)
  const [importantPurchase, setImportantPurchase] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [statusType, setStatusType] = useState<'error' | 'info'>('error')
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [guestPromptOpen, setGuestPromptOpen] = useState(false)
  const [verdictsUsedToday, setVerdictsUsedToday] = useState(0)
  const [verdictsRemainingToday, setVerdictsRemainingToday] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const generationLockMessage =
    'Another verdict is currently being generated or regenerated. Please wait for it to finish.'
  const justificationWordCount = countWords(justification)
  const rotatingJustificationQuestion = JUSTIFICATION_PLACEHOLDERS[justificationPlaceholderIndex]
  const nextVerdictRefreshAt = getNextUtcMidnight(nowMs)
  const verdictRefreshCountdown = formatCountdown(nextVerdictRefreshAt.getTime() - nowMs)
  const verdictRefreshLabel = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(nextVerdictRefreshAt)
  const justificationDetail =
    justificationWordCount === 0
      ? rotatingJustificationQuestion
      : justificationWordCount < JUSTIFICATION_WORD_MIN
        ? `${justificationWordCount} words. Add a bit more context for a stronger verdict.`
        : justificationWordCount > JUSTIFICATION_WORD_MAX
          ? `${justificationWordCount} words. Consider tightening this so the verdict stays focused.`
          : `${justificationWordCount} words. This is a good level of detail.`

  const loadStats = useCallback(async () => {
    if (!session) return
    const data = await getSwipeStats(session.user.id)
    setStats(data)
  }, [session])

  const loadRecentVerdicts = useCallback(async () => {
    if (!session) return
    try {
      const data = await getVerdictHistory(session.user.id, 3)
      setRecentVerdicts(data)

      const todayUtc = new Date()
      todayUtc.setUTCHours(0, 0, 0, 0)
      const usedToday = data.filter(
        (v) =>
          v.created_at !== null &&
          new Date(v.created_at).getTime() >= todayUtc.getTime() &&
          v.scoring_model !== 'heuristic_fallback'
      ).length
      setVerdictsUsedToday(usedToday)
      setVerdictsRemainingToday(Math.max(0, DAILY_LIMIT - usedToday))
    } catch (error) {
      logger.warn('Failed to load verdict history', { error: (error as Error).message })
    } finally {
      setVerdictHistoryLoaded(true)
    }
  }, [session])

  const handlePaywallError = useCallback((error: unknown) => {
    if (
      error instanceof Error &&
      error.message === 'daily_limit_reached' &&
      'paywallData' in error
    ) {
      const paywallData = (error as Error & { paywallData: Record<string, unknown> }).paywallData
      const usedToday = (paywallData.verdicts_used_today as number | undefined) ?? DAILY_LIMIT
      setVerdictsUsedToday(usedToday)
      setVerdictsRemainingToday(0)
      analytics.trackPaywallHit({
        verdicts_used_today: usedToday,
        session_verdicts_count: sessionVerdictsCountRef.current,
        time_of_day: new Date().getUTCHours(),
        day_of_week: new Date().getUTCDay(),
      })
      setPaywallOpen(true)
      return true
    }
    return false
  }, [])

  const isGuest = session?.user.is_anonymous ?? false

  const handleViewAllVerdicts = (e: React.MouseEvent) => {
    if (isGuest) {
      e.preventDefault()
      setGuestPromptOpen(true)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStats()
      void loadRecentVerdicts()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadStats, loadRecentVerdicts])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (justification.trim().length > 0) {
      setJustificationPlaceholderIndex(0)
      setIsJustificationGuidanceVisible(true)
      return
    }

    let fadeTimeoutId: number | null = null
    const intervalId = window.setInterval(() => {
      setIsJustificationGuidanceVisible(false)
      fadeTimeoutId = window.setTimeout(() => {
        setJustificationPlaceholderIndex((current) => (current + 1) % JUSTIFICATION_PLACEHOLDERS.length)
        setIsJustificationGuidanceVisible(true)
      }, JUSTIFICATION_GUIDANCE_FADE_MS)
    }, JUSTIFICATION_GUIDANCE_ROTATION_MS)

    return () => {
      window.clearInterval(intervalId)
      if (fadeTimeoutId !== null) {
        window.clearTimeout(fadeTimeoutId)
      }
    }
  }, [justification])

  const trackFieldFocus = useCallback((fieldName: string) => {
    if (!formFieldsRef.current.has(fieldName)) {
      formFieldsRef.current.add(fieldName)
      analytics.trackFormFieldFocused(fieldName)
    }
    if (formStartRef.current === null) {
      formStartRef.current = Date.now()
    }
  }, [])

  // Track form abandonment on unmount
  useEffect(() => {
    return () => {
      if (
        formFieldsRef.current.size > 0 &&
        !formSubmittedRef.current &&
        formStartRef.current !== null
      ) {
        analytics.trackFormAbandoned(
          formFieldsRef.current.size,
          (Date.now() - formStartRef.current) / 1000,
        )
      }
    }
  }, [])

  const resetForm = () => {
    setTitle('')
    setBrand('')
    setPrice('')
    setCategory('other')
    setJustification('')
    setMotivation(null)
    setImportantPurchase(false)
    formStartRef.current = null
    formFieldsRef.current = new Set()
    formSubmittedRef.current = false
  }

  const handleEvaluate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session) return
    if (submitting || verdictRegeneratingId) {
      window.alert(generationLockMessage)
      return
    }

    const priceValue = price ? Number(price) : null
    if (!title.trim()) {
      setStatus('Item title is required.')
      setStatusType('error')
      analytics.trackFormValidationError('title', 'required')
      return
    }

    setSubmitting(true)
    setStatus('')
    setStatusType('error')
    analytics.trackVerdictRequested({
      product_category: category || 'other',
      price_range: bucketPrice(priceValue),
      input_method: 'manual',
      user_tier: 'free',
      verdicts_remaining_today: verdictsRemainingToday,
    })
    evalStartRef.current = Date.now()

    const input = {
      title: title.trim(),
      price: priceValue,
      category: category.trim() || null,
      vendor: brand.trim() || null,
      justification: justification.trim() || null,
      motivation,
      isImportant: importantPurchase,
    }

    try {
      const evaluation = await evaluatePurchase(
        session.user.id,
        input
      )

      analytics.trackVerdictEvalDuration(
        Date.now() - evalStartRef.current,
        !!evaluation.fallbackReason,
      )

      if (evaluation.fallbackReason) {
        setStatus(`AI analysis was unavailable — verdict based on pattern matching.`)
        setStatusType('info')
      }

      if (evaluation.verdictsRemaining !== undefined) {
        setVerdictsRemainingToday(evaluation.verdictsRemaining)
        setVerdictsUsedToday(DAILY_LIMIT - evaluation.verdictsRemaining)
      }

      const { data: submittedVerdict, error } = await submitVerdict(session.user.id, input, evaluation)

      if (error) {
        setStatus(error)
        setStatusType('error')
        return
      }

      if (submittedVerdict) {
        sessionVerdictsCountRef.current += 1
        analytics.trackVerdictDelivered({
          verdict_outcome: evaluation.outcome ?? 'unknown',
          confidence_score: evaluation.confidence ?? null,
          response_latency_ms: Date.now() - evalStartRef.current,
          verdict_id: submittedVerdict.id,
        })
      }

      const decisionTimeSeconds = formStartRef.current
        ? (Date.now() - formStartRef.current) / 1000
        : 0
      analytics.trackVerdictSubmitted({
        verdictValue: evaluation.outcome ?? 'unknown',
        category: input.category ?? 'other',
        price: priceValue,
        decisionTimeSeconds,
      })
      formSubmittedRef.current = true
      resetForm()
      await loadStats()
      await loadRecentVerdicts()
    } catch (error) {
      if (handlePaywallError(error)) return
      logger.error('Evaluation failed', { error: error instanceof Error ? error.message : String(error) })
      analytics.trackVerdictEvalError(error instanceof Error ? error.message : 'unknown')
      setStatus('Something went wrong while evaluating. Please try again.')
      setStatusType('error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerdictDecision = async (
    verdictId: string,
    decision: 'bought' | 'hold' | 'skip',
  ) => {
    if (!session) return

    setVerdictSavingId(verdictId)
    setStatus('')

    const verdict = recentVerdicts.find((v) => v.id === verdictId)
    const verdictAgeSeconds = verdict?.created_at
      ? (Date.now() - new Date(verdict.created_at).getTime()) / 1000
      : 0

    const { error } = await updateVerdictDecision(session.user.id, verdictId, decision)

    if (error) {
      setStatus(error)
      setVerdictSavingId(null)
      return
    }

    analytics.trackVerdictDecision(decision, verdictAgeSeconds)

    const isOverride =
      (verdict?.predicted_outcome === 'buy' && decision === 'skip') ||
      (verdict?.predicted_outcome === 'skip' && decision === 'bought')
    if (isOverride && verdict) {
      analytics.trackVerdictOverride({
        verdict_id: verdictId,
        original_verdict: verdict.predicted_outcome ?? 'unknown',
        user_action: decision === 'skip' ? 'skipped_anyway' : 'bought_anyway',
        time_since_verdict_ms: verdictAgeSeconds * 1000,
      })
    }

    await loadStats()
    await loadRecentVerdicts()
    setVerdictSavingId(null)
  }

  const handleVerdictFeedback = async (verdict: VerdictRow, value: 1 | -1) => {
    if (!session) return

    const newFeedback = verdict.verdict_feedback === value ? null : value
    const previous = verdict.verdict_feedback ?? null

    setRecentVerdicts((prev) =>
      prev.map((v) =>
        v.id === verdict.id ? { ...v, verdict_feedback: newFeedback } : v
      )
    )

    const feedbackLabel = newFeedback === 1 ? 'up' : newFeedback === -1 ? 'down' : 'removed'
    analytics.trackVerdictFeedback(feedbackLabel, verdict.predicted_outcome ?? 'unknown')

    const { error } = await updateVerdictFeedback(session.user.id, verdict.id, newFeedback)

    if (error) {
      setRecentVerdicts((prev) =>
        prev.map((v) =>
          v.id === verdict.id ? { ...v, verdict_feedback: previous } : v
        )
      )
      setStatus(error)
    }
  }

  const handleVerdictRegenerate = async (verdict: VerdictRow) => {
    if (!session) return
    if (submitting || verdictRegeneratingId) {
      window.alert(generationLockMessage)
      return
    }

    setVerdictRegeneratingId(verdict.id)
    setStatus('')
    regenStartRef.current = Date.now()

    try {
      const input = inputFromVerdict(verdict)
      const evaluation = await evaluatePurchase(session.user.id, input, verdict.id)

      if (evaluation.fallbackReason) {
        setStatus('AI analysis was unavailable — verdict based on pattern matching.')
        setStatusType('info')
      }

      const { data, error } = await submitVerdict(
        session.user.id,
        input,
        evaluation,
        verdict.id
      )

      if (error || !data) {
        setStatus(error ?? 'Failed to regenerate verdict.')
        setStatusType('error')
        return
      }

      analytics.trackVerdictRegenDuration(Date.now() - regenStartRef.current)
      analytics.trackVerdictRegenerated()

      setRecentVerdicts((previousVerdicts) =>
        previousVerdicts.map((previousVerdict) =>
          previousVerdict.id === data.id ? data : previousVerdict
        )
      )
      if (selectedVerdict?.id === data.id) {
        setSelectedVerdict(data)
      }
      await loadStats()
    } catch (error) {
      if (handlePaywallError(error)) return
      setStatus('Failed to regenerate verdict.')
    } finally {
      setVerdictRegeneratingId((currentVerdictId) =>
        currentVerdictId === verdict.id ? null : currentVerdictId
      )
    }
  }

  const toggleRationale = (verdictId: string) => {
    setExpandedRationales((prev) => {
      const next = new Set(prev)
      if (next.has(verdictId)) {
        next.delete(verdictId)
      } else {
        next.add(verdictId)
        analytics.trackVerdictRationaleExpanded()
      }
      return next
    })
  }

  /* ── Verdict card stagger entrance ── */
  useEffect(() => {
    if (recentVerdicts.length === 0 || prefersReducedMotion()) return
    gsap.fromTo(
      '.verdict-stack-vertical .verdict-card',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out' },
    )
  }, [recentVerdicts.length])

  /* ── Form section fade-in on mount ── */
  const formSectionRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!formSectionRef.current || prefersReducedMotion()) return
    gsap.fromTo(
      formSectionRef.current,
      { opacity: 0, y: 15 },
      { opacity: 1, y: 0, duration: 0.6, delay: 0.2, ease: 'power3.out' },
    )
  }, [])

  const emptyStateTrackedRef = useRef(false)
  useEffect(() => {
    if (recentVerdicts.length === 0 && !emptyStateTrackedRef.current && session) {
      emptyStateTrackedRef.current = true
      analytics.trackEmptyStateShown('dashboard', 'no_verdicts')
    }
  }, [recentVerdicts.length, session])

  return (
    <section className="route-content">
      {/* Mobile: collapsible reflection bar */}
      <div className={`reflection-bar${reflectionExpanded ? ' expanded' : ''}`}>
        <button
          type="button"
          className="reflection-bar-summary"
          onClick={() => setReflectionExpanded((prev) => !prev)}
        >
          <span className="reflection-bar-label">Today's reflection</span>
          <span className={`reflection-bar-chevron${reflectionExpanded ? ' expanded' : ''}`} aria-hidden="true">
            ▾
          </span>
        </button>
        <div className={`reflection-bar-list${reflectionExpanded ? ' expanded' : ''}`}>
          {recentVerdicts.length > 0 ? (
            recentVerdicts.map((verdict) => (
              <div
                key={verdict.id}
                className="reflection-bar-item"
                onClick={() => setSelectedVerdict(verdict)}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) =>
                  e.key === 'Enter' && setSelectedVerdict(verdict)
                }
                role="button"
                tabIndex={0}
              >
                <span className="reflection-bar-item-title">{verdict.candidate_title}</span>
                {verdict.candidate_price && (
                  <span className="reflection-bar-item-price">
                    {formatCurrency(verdict.candidate_price)}
                  </span>
                )}
                <span className={`outcome-chip outcome-${verdict.predicted_outcome}`}>
                  {outcomeLabel(verdict.predicted_outcome)}
                </span>
              </div>
            ))
          ) : (
            <div className="reflection-bar-empty">No verdicts yet</div>
          )}
          <Link to="/profile?tab=verdicts" className="reflection-bar-more" onClick={handleViewAllVerdicts}>
            View all verdicts
          </Link>
        </div>
      </div>

      {/* Desktop: full heading + stats */}
      <h1 className="desktop-only"><SplitText>Today's reflection</SplitText></h1>

      <div className="stat-strip desktop-only">
        <span className="stat-strip-item">
          <span className="stat-strip-value">{stats.swipesCompleted}</span> swiped
        </span>
        <span className="stat-strip-separator" aria-hidden="true" />
        <span className="stat-strip-item">
          <span className="stat-strip-value">{stats.regretRate}%</span> regret
        </span>
        <span className="stat-strip-separator" aria-hidden="true" />
        <span className="stat-strip-item">
          <span className="stat-strip-value">{stats.activeHolds}</span> holds
        </span>
      </div>

      {status && <div className={`status ${statusType}`}>{status}</div>}

      <div className="dashboard-grid">
        <div className="verdict-result">
          <div className="section-header">
            <h2>Latest verdicts</h2>
            <LiquidButton as={Link} to="/profile?tab=verdicts" className="ghost" onClick={handleViewAllVerdicts}>More</LiquidButton>
          </div>
          {recentVerdicts.length > 0 ? (
            <div className="verdict-stack-vertical">
              {recentVerdicts.map((verdict) => {
                const rationale =
                  (verdict.reasoning as { rationale?: string } | null)?.rationale ?? ''
                const isExpanded = expandedRationales.has(verdict.id)
                return (
                <GlassCard
                  key={verdict.id}
                  className={`verdict-card outcome-${verdict.predicted_outcome}`}
                >
                    <div
                      className="verdict-card-clickable"
                      onClick={() => {
                        analytics.trackVerdictDetailOpened(verdict.predicted_outcome ?? 'unknown')
                        setSelectedVerdict(verdict)
                      }}
                      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === 'Enter') {
                          analytics.trackVerdictDetailOpened(verdict.predicted_outcome ?? 'unknown')
                          setSelectedVerdict(verdict)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                    <div className="verdict-header">
                      <span className="verdict-title">{verdict.candidate_title}</span>
                      <span className="verdict-outcome">
                        {verdict.predicted_outcome === 'buy' && '✓ Buy'}
                        {verdict.predicted_outcome === 'hold' && `⏸ Hold for ${preferences.hold_duration_hours}h`}
                        {verdict.predicted_outcome === 'skip' && '✗ Skip'}
                      </span>
                    </div>
                    {verdict.candidate_price && (
                      <span className="verdict-price">
                        {formatCurrency(verdict.candidate_price)}
                      </span>
                    )}
                    {verdict.hold_release_at && (
                      <span className="verdict-hold">
                        Hold expires:{' '}
                        {formatDateTime(verdict.hold_release_at)}
                      </span>
                    )}
                    <div className="verdict-meta">
                      <span><strong>Brand: </strong>
                        {verdict.candidate_vendor ?? '—'}
                        </span>
                      {rationale && (
                        <div className={`rationale-container ${isExpanded ? 'expanded' : ''}`}>
                          <strong>Rationale</strong>
                          <div
                            className={`rationale-content ${isExpanded ? '' : 'rationale-clamped'}`}
                            dangerouslySetInnerHTML={{
                              __html: sanitizeVerdictRationaleHtml(rationale),
                            }}
                          />
                          <button
                            type="button"
                            className="rationale-toggle"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleRationale(verdict.id)
                            }}
                          >
                            {isExpanded ? 'Show less' : 'Show more'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                <div className="verdict-actions">
                  <div className="verdict-action-links">
                    <LiquidButton
                      type="button"
                      className="link"
                      onClick={() => setShareModalVerdict(verdict)}
                    >
                      Share
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className="link"
                      onClick={() => handleVerdictRegenerate(verdict)}
                      disabled={
                        submitting || verdictRegeneratingId !== null || verdictSavingId === verdict.id
                      }
                    >
                      {verdictRegeneratingId === verdict.id ? 'Regenerating...' : 'Regenerate'}
                    </LiquidButton>
                  </div>
                  <div className="verdict-feedback-buttons">
                    <button
                      type="button"
                      className={`feedback-btn feedback-up ${verdict.verdict_feedback === 1 ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleVerdictFeedback(verdict, 1) }}
                      disabled={verdictSavingId === verdict.id || verdictRegeneratingId !== null}
                      aria-label="Helpful verdict"
                      title="Helpful"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`feedback-btn feedback-down ${verdict.verdict_feedback === -1 ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleVerdictFeedback(verdict, -1) }}
                      disabled={verdictSavingId === verdict.id || verdictRegeneratingId !== null}
                      aria-label="Unhelpful verdict"
                      title="Not helpful"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
                        <path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                      </svg>
                    </button>
                  </div>
                  <div className="decision-buttons">
                    <LiquidButton
                      type="button"
                      className={`decision-btn bought ${verdict.user_decision === 'bought' ? 'active' : ''}`}
                      onClick={() => handleVerdictDecision(verdict.id, 'bought')}
                      disabled={verdictSavingId === verdict.id || verdictRegeneratingId !== null}
                    >
                      Bought
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className={`decision-btn hold ${verdict.user_decision === 'hold' ? 'active' : ''}`}
                      onClick={() => handleVerdictDecision(verdict.id, 'hold')}
                      disabled={verdictSavingId === verdict.id || verdictRegeneratingId !== null}
                    >
                      Hold {preferences.hold_duration_hours}h
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className={`decision-btn skip ${verdict.user_decision === 'skip' ? 'active' : ''}`}
                      onClick={() => handleVerdictDecision(verdict.id, 'skip')}
                      disabled={verdictSavingId === verdict.id || verdictRegeneratingId !== null}
                    >
                      Skip
                    </LiquidButton>
                  </div>
                </div>
                </GlassCard>
              )
            })}
            </div>
          ) : (
            <div className="empty-card">No verdicts yet.</div>
          )}
        </div>

        <div className="decision-section" ref={formSectionRef}>
          <div className="decision-section-header">
            <h2>New evaluation</h2>
            {verdictsRemainingToday !== null && (
              <div className="verdicts-remaining-meta">
                <span className={`verdicts-remaining-pill${verdictsRemainingToday === 0 ? ' exhausted' : ''}`}>
                  {verdictsRemainingToday === 0
                    ? 'Daily limit reached'
                    : `${verdictsRemainingToday} free verdict${verdictsRemainingToday === 1 ? '' : 's'} remaining today`}
                </span>
                <span className="verdicts-refresh-text">
                  Refreshes in {verdictRefreshCountdown} • {verdictRefreshLabel}
                </span>
              </div>
            )}
          </div>
          <form className="decision-form" onSubmit={(e) => void handleEvaluate(e)}>
            <label>
              Product
              <VolumetricInput
                as="input"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                onFocus={() => trackFieldFocus('title')}
                placeholder="e.g. Sony WH-1000XM5 from Amazon"
                required
              />
            </label>

            <label>
              Brand
              <VolumetricInput
                as="input"
                value={brand}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setBrand(e.target.value)}
                onFocus={() => trackFieldFocus('brand')}
                placeholder="e.g. Sony"
              />
            </label>

            <div className="form-row">
              <label>
                Price
                <VolumetricInput
                  as="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                  onFocus={() => trackFieldFocus('price')}
                  placeholder="299.00"
                />
              </label>
              <label>
                Category
                <VolumetricInput
                  as="select"
                  value={category}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
                  onFocus={() => trackFieldFocus('category')}
                >
                  {PURCHASE_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </VolumetricInput>
              </label>
            </div>

            <div className="form-field-group">
              <span className="form-field-label">Why do you want this?</span>
              <div className="motivation-chips">
                {PURCHASE_MOTIVATIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={`motivation-chip${motivation === m.value ? ' active' : ''}`}
                    onClick={() => setMotivation(motivation === m.value ? null : m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <GlassCard className="textarea-wrapper">
                {justificationWordCount === 0 && (
                  <span
                    className={`textarea-ghost-prompt${isJustificationGuidanceVisible ? '' : ' is-fading'}`}
                    aria-hidden="true"
                  >
                    {rotatingJustificationQuestion}
                  </span>
                )}
                <textarea
                  value={justification}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setJustification(e.target.value)}
                  onFocus={() => trackFieldFocus('justification')}
                  placeholder=""
                  rows={3}
                />
              </GlassCard>
              <p
                className="justification-guidance"
                aria-live={justificationWordCount === 0 ? 'off' : 'polite'}
              >
                <span className="justification-guidance-static">
                  Recommended length: {JUSTIFICATION_WORD_MIN}-{JUSTIFICATION_WORD_MAX} words.
                </span>{' '}
              </p>
            </div>

            <div className="form-actions-row">
              <div className="toggle-row">
                <input
                  id="important-purchase-toggle"
                  type="checkbox"
                  checked={importantPurchase}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setImportantPurchase(e.target.checked)}
                  aria-labelledby="important-purchase-label"
                />
                <span id="important-purchase-label" className="toggle-label">
                  Important purchase
                </span>
              </div>
              <LiquidButton className="primary" type="submit" disabled={submitting}>
                {submitting ? 'Evaluating...' : 'Evaluate'}
              </LiquidButton>
            </div>
          </form>
        </div>
      </div>

      {selectedVerdict && createPortal(
        <VerdictDetailModal
          verdict={selectedVerdict}
          isOpen={selectedVerdict !== null}
          onClose={() => setSelectedVerdict(null)}
          onRegenerate={handleVerdictRegenerate}
          onShare={(v) => {
            setSelectedVerdict(null)
            setShareModalVerdict(v)
          }}
          onFeedback={(v, value) => {
            handleVerdictFeedback(v, value)
            const newFeedback = v.verdict_feedback === value ? null : value
            setSelectedVerdict({ ...v, verdict_feedback: newFeedback })
          }}
          isRegenerating={verdictRegeneratingId === selectedVerdict.id}
        />,
        document.body
      )}

      {shareModalVerdict && session && createPortal(
        <VerdictShareModal
          verdict={shareModalVerdict}
          userId={session.user.id}
          isOpen={shareModalVerdict !== null}
          onClose={() => setShareModalVerdict(null)}
        />,
        document.body
      )}

      {createPortal(
        <EvaluatingModal isOpen={submitting || verdictRegeneratingId !== null} />,
        document.body
      )}

      {paywallOpen && createPortal(
        <PaywallModal
          isOpen={paywallOpen}
          onClose={() => setPaywallOpen(false)}
          onSignUp={() => { setPaywallOpen(false); navigate('/auth?mode=sign_up') }}
          verdictsUsedToday={verdictsUsedToday}
          dailyLimit={DAILY_LIMIT}
          isAnonymous={isGuest}
        />,
        document.body
      )}

      {guestPromptOpen && createPortal(
        <GuestPromptModal
          isOpen={guestPromptOpen}
          onClose={() => setGuestPromptOpen(false)}
          onSignUp={() => { setGuestPromptOpen(false); navigate('/auth?mode=sign_up') }}
        />,
        document.body
      )}

      <OnboardingTutorial
        userId={session?.user.id ?? null}
        hasVerdicts={recentVerdicts.length > 0}
        dataLoaded={verdictHistoryLoaded}
        onNavigate={(route) => navigate(route)}
      />
    </section>
  )
}
