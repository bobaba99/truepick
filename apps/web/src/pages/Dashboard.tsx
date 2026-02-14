import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import type { Stats, VerdictRow } from '../api/core/types'
import { PURCHASE_CATEGORIES } from '../api/core/types'
import { getSwipeStats } from '../api/purchase/statsService'
import { sanitizeVerdictRationaleHtml } from '../utils/sanitizeHtml'
import {
  getVerdictHistory,
  evaluatePurchase,
  submitVerdict,
  inputFromVerdict,
  updateVerdictDecision,
} from '../api/verdict/verdictService'
import VerdictDetailModal from '../components/VerdictDetailModal'
import { GlassCard, LiquidButton, VolumetricInput, SplitText } from '../components/Kinematics'

type DashboardProps = {
  session: Session | null
}

export default function Dashboard({ session }: DashboardProps) {
  const [stats, setStats] = useState<Stats>({
    swipesCompleted: 0,
    regretRate: 0,
    activeHolds: 0,
  })
  const [recentVerdicts, setRecentVerdicts] = useState<VerdictRow[]>([])
  const [selectedVerdict, setSelectedVerdict] = useState<VerdictRow | null>(null)
  const [verdictSavingId, setVerdictSavingId] = useState<string | null>(null)
  const [verdictRegeneratingId, setVerdictRegeneratingId] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('other')
  const [vendor, setVendor] = useState('')
  const [justification, setJustification] = useState('')
  const [importantPurchase, setImportantPurchase] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<string>('')
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
    setVendor('')
    setJustification('')
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
      return
    }

    setSubmitting(true)
    setStatus('')

    const input = {
      title: title.trim(),
      price: priceValue,
      category: category.trim() || null,
      vendor: vendor.trim() || null,
      justification: justification.trim() || null,
      isImportant: importantPurchase,
    }

    // Get API key from environment (in production, this should be handled server-side)
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined

    const evaluation = await evaluatePurchase(
      session.user.id,
      input,
      openaiApiKey
    )
    const { error } = await submitVerdict(session.user.id, input, evaluation)

    if (error) {
      setStatus(error)
      setSubmitting(false)
      return
    }

    resetForm()
    await loadStats()
    await loadRecentVerdicts()
    setSubmitting(false)
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
      const { data, error } = await submitVerdict(
        session.user.id,
        input,
        evaluation,
        verdict.id
      )

      if (error || !data) {
        setStatus(error ?? 'Failed to regenerate verdict.')
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

  return (
    <section className="route-content">
      <h1><SplitText>Today's reflection</SplitText></h1>
      <div className="stat-grid">
        <GlassCard className="stat-card">
          <span className="stat-label">Swipes completed</span>
          <span className="stat-value">{stats.swipesCompleted}</span>
        </GlassCard>
        <GlassCard className="stat-card">
          <span className="stat-label">Regret rate</span>
          <span className="stat-value">{stats.regretRate}%</span>
        </GlassCard>
        <GlassCard className="stat-card">
          <span className="stat-label">24h holds active</span>
          <span className="stat-value">{stats.activeHolds}</span>
        </GlassCard>
      </div>
      <p>
        Considering a purchase? Enter the details below and we'll evaluate it
        against your patterns.
      </p>

      {status && <div className="status error">{status}</div>}

      <div className="dashboard-grid">
        <div className="decision-section">
          <h2>New purchase decision</h2>
          <form className="decision-form" onSubmit={handleEvaluate}>
            <label>
              What do you want to buy?
              <VolumetricInput
                as="input"
                value={title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Noise cancelling headphones"
                required
              />
            </label>
            <label>
              Brand / Vendor
              <VolumetricInput
                as="input"
                value={vendor}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setVendor(e.target.value)}
                placeholder="Amazon"
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
            <label>
              Why do you want this?
              <GlassCard className="textarea-wrapper">
                <textarea
                  value={justification}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setJustification(e.target.value)}
                  placeholder="I need it for work calls..."
                  rows={8}
                />
              </GlassCard>
            </label>
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
            <div className="algorithm-toggle">
              <span className="toggle-label">Scoring model</span>
              <div className="segmented-toggle" role="radiogroup" aria-label="Scoring model">
                <label>
                  <input type="radio" name="verdict-algorithm" value="llm_only" checked readOnly />
                  <span>LLM only</span>
                </label>
              </div>
            </div>
            <LiquidButton className="primary" type="submit" disabled={submitting}>
              {submitting ? 'Evaluating...' : 'Evaluate'}
            </LiquidButton>
          </form>
        </div>

        <div className="verdict-result">
          <div className="section-header">
            <h2>Latest verdict</h2>
            <LiquidButton as={Link} to="/profile" className="ghost">More</LiquidButton>
          </div>
          {recentVerdicts.length > 0 ? (
            <div className="verdict-stack-vertical">
              {recentVerdicts.map((verdict) => {
                const rationale =
                  (verdict.reasoning as { rationale?: string } | null)?.rationale ?? ''
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
                        {verdict.predicted_outcome === 'hold' && '⏸ Hold for 24h'}
                        {verdict.predicted_outcome === 'skip' && '✗ Skip'}
                      </span>
                    </div>
                    {verdict.candidate_price && (
                      <span className="verdict-price">
                        ${verdict.candidate_price.toFixed(2)}
                      </span>
                    )}
                    {verdict.hold_release_at && (
                      <span className="verdict-hold">
                        Hold expires:{' '}
                        {new Date(verdict.hold_release_at).toLocaleString()}
                      </span>
                    )}
                    <div className="verdict-meta">
                      <span><strong>Brand: </strong>
                        {verdict.candidate_vendor ?? '—'}
                        </span>
                      {rationale && (
                        <div>
                          <strong>Rationale</strong>
                          <div
                            dangerouslySetInnerHTML={{
                              __html: sanitizeVerdictRationaleHtml(rationale),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                <div className="verdict-actions">
                  <div className="decision-buttons">
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
                        Hold 24h
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
      </div>

      {selectedVerdict && (
        <VerdictDetailModal
          verdict={selectedVerdict}
          isOpen={selectedVerdict !== null}
          onClose={() => setSelectedVerdict(null)}
          onRegenerate={handleVerdictRegenerate}
          isRegenerating={verdictRegeneratingId === selectedVerdict.id}
        />
      )}
    </section>
  )
}
