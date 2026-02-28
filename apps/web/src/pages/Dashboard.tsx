import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
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
} from '../api/verdict/verdictService'
import VerdictDetailModal from '../components/VerdictDetailModal'
import VerdictShareModal from '../components/VerdictShareModal'
import EvaluatingModal from '../components/EvaluatingModal'
import { GlassCard, LiquidButton, VolumetricInput, SplitText } from '../components/Kinematics'
import { useUserFormatting, useUserPreferences } from '../preferences/UserPreferencesContext'

type DashboardProps = {
  session: Session | null
}

export default function Dashboard({ session }: DashboardProps) {
  const { preferences } = useUserPreferences()
  const { formatCurrency, formatDateTime } = useUserFormatting()
  const [stats, setStats] = useState<Stats>({
    swipesCompleted: 0,
    regretRate: 0,
    activeHolds: 0,
  })
  const [recentVerdicts, setRecentVerdicts] = useState<VerdictRow[]>([])
  const [selectedVerdict, setSelectedVerdict] = useState<VerdictRow | null>(null)
  const [shareModalVerdict, setShareModalVerdict] = useState<VerdictRow | null>(null)
  const [verdictSavingId, setVerdictSavingId] = useState<string | null>(null)
  const [verdictRegeneratingId, setVerdictRegeneratingId] = useState<string | null>(null)
  const [expandedRationales, setExpandedRationales] = useState<Set<string>>(new Set())
  const [reflectionExpanded, setReflectionExpanded] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('other')
  const [justification, setJustification] = useState('')
  const [motivation, setMotivation] = useState<PurchaseMotivation | null>(null)
  const [importantPurchase, setImportantPurchase] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [statusType, setStatusType] = useState<'error' | 'info'>('error')
  const generationLockMessage =
    'Another verdict is currently being generated or regenerated. Please wait for it to finish.'

  const loadStats = useCallback(async () => {
    if (!session) return
    const data = await getSwipeStats(session.user.id)
    setStats(data)
  }, [session])

  const loadRecentVerdicts = useCallback(async () => {
    if (!session) return
    const data = await getVerdictHistory(session.user.id, 3)
    setRecentVerdicts(data)
  }, [session])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStats()
      void loadRecentVerdicts()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadStats, loadRecentVerdicts])

  const resetForm = () => {
    setTitle('')
    setPrice('')
    setCategory('other')
    setJustification('')
    setMotivation(null)
    setImportantPurchase(false)
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
      return
    }

    setSubmitting(true)
    setStatus('')
    setStatusType('error')

    const input = {
      title: title.trim(),
      price: priceValue,
      category: category.trim() || null,
      vendor: null,
      justification: justification.trim() || null,
      motivation,
      isImportant: importantPurchase,
    }

    try {
      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined

      const evaluation = await evaluatePurchase(
        session.user.id,
        input,
        openaiApiKey
      )

      if (evaluation.fallbackReason) {
        setStatus(`AI analysis was unavailable — verdict based on pattern matching.`)
        setStatusType('info')
      }

      const { error } = await submitVerdict(session.user.id, input, evaluation)

      if (error) {
        setStatus(error)
        setStatusType('error')
        return
      }

      resetForm()
      await loadStats()
      await loadRecentVerdicts()
    } catch (error) {
      logger.error('Evaluation failed', { error: error instanceof Error ? error.message : String(error) })
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

    const { error } = await updateVerdictDecision(session.user.id, verdictId, decision)

    if (error) {
      setStatus(error)
      setVerdictSavingId(null)
      return
    }

    await loadStats()
    await loadRecentVerdicts()
    setVerdictSavingId(null)
  }

  const handleVerdictRegenerate = async (verdict: VerdictRow) => {
    if (!session) return
    if (submitting || verdictRegeneratingId) {
      window.alert(generationLockMessage)
      return
    }

    setVerdictRegeneratingId(verdict.id)
    setStatus('')

    try {
      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
      const input = inputFromVerdict(verdict)
      const evaluation = await evaluatePurchase(session.user.id, input, openaiApiKey)

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

      setRecentVerdicts((previousVerdicts) =>
        previousVerdicts.map((previousVerdict) =>
          previousVerdict.id === data.id ? data : previousVerdict
        )
      )
      if (selectedVerdict?.id === data.id) {
        setSelectedVerdict(data)
      }
      await loadStats()
    } catch {
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
      }
      return next
    })
  }

  const outcomeLabel = (outcome: string | null) => {
    if (outcome === 'buy') return 'Buy'
    if (outcome === 'hold') return 'Hold'
    return 'Skip'
  }

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
          <Link to="/profile?tab=verdicts" className="reflection-bar-more">
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
            <LiquidButton as={Link} to="/profile?tab=verdicts" className="ghost">More</LiquidButton>
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
                      onClick={() => setSelectedVerdict(verdict)}
                      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) =>
                        e.key === 'Enter' && setSelectedVerdict(verdict)
                      }
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

        <div className="decision-section">
          <h2>New evaluation</h2>
          <form className="decision-form" onSubmit={(e) => void handleEvaluate(e)}>
            <label>
              Product
              <VolumetricInput
                as="input"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="e.g. Sony WH-1000XM5 from Amazon"
                required
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
                  placeholder="299.00"
                />
              </label>
              <label>
                Category
                <VolumetricInput
                  as="select"
                  value={category}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
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
                <textarea
                  value={justification}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setJustification(e.target.value)}
                  placeholder="I need it for work calls..."
                  rows={3}
                />
              </GlassCard>
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
    </section>
  )
}
