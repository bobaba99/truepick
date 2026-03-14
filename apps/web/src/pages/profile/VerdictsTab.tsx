import type { KeyboardEvent } from 'react'
import type { VerdictRow, UserDecision } from '../../api/core/types'
import type { FilterState } from '../../components/ListFilters.model'
import { GlassCard, LiquidButton } from '../../components/Kinematics'
import ListFilters from '../../components/ListFilters'
import { analytics } from '../../hooks/useAnalytics'

type VerdictsTabProps = {
  verdicts: VerdictRow[]
  filteredVerdicts: VerdictRow[]
  verdictsRemainingToday: number | null
  verdictSavingId: string | null
  verdictRegeneratingId: string | null
  verdictSearch: string
  verdictFilters: FilterState
  verdictFiltersOpen: boolean
  holdDurationHours: number
  onSearchChange: (value: string) => void
  onFilterChange: (filters: FilterState) => void
  onToggleFilters: () => void
  onSelectVerdict: (verdict: VerdictRow) => void
  onShareVerdict: (verdict: VerdictRow) => void
  onRegenerateVerdict: (verdict: VerdictRow) => void
  onDecision: (verdictId: string, decision: UserDecision) => void
  onFeedback: (verdict: VerdictRow, value: 1 | -1) => void
  onDeleteVerdict: (verdictId: string) => void
  formatCurrency: (value: number | null) => string
  formatDate: (value: string | null) => string
}

export default function VerdictsTab({
  verdicts,
  filteredVerdicts,
  verdictsRemainingToday,
  verdictSavingId,
  verdictRegeneratingId,
  verdictSearch,
  verdictFilters,
  verdictFiltersOpen,
  holdDurationHours,
  onSearchChange,
  onFilterChange,
  onToggleFilters,
  onSelectVerdict,
  onShareVerdict,
  onRegenerateVerdict,
  onDecision,
  onFeedback,
  onDeleteVerdict,
  formatCurrency,
  formatDate,
}: VerdictsTabProps) {
  return (
    <div className="verdict-result" style={{ marginTop: 0 }}>
      <div className="section-header">
        <div className="section-header-title-row">
          <h2>Verdict history</h2>
          {verdictsRemainingToday !== null && (
            <span className={`verdicts-remaining-pill${verdictsRemainingToday === 0 ? ' exhausted' : ''}`}>
              {verdictsRemainingToday === 0
                ? 'Daily limit reached'
                : `${verdictsRemainingToday} verdict${verdictsRemainingToday === 1 ? '' : 's'} left today`}
            </span>
          )}
        </div>
        <LiquidButton
          type="button"
          className="ghost"
          onClick={onToggleFilters}
        >
          {verdictFiltersOpen ? 'Hide filters' : 'Filter / Search'}
        </LiquidButton>
      </div>
      <div className={`collapsible ${verdictFiltersOpen ? 'open' : ''}`}>
        <ListFilters
          search={verdictSearch}
          onSearchChange={onSearchChange}
          filters={verdictFilters}
          onFilterChange={onFilterChange}
          type="verdict"
        />
      </div>
      {filteredVerdicts.length === 0 ? (
        <div className="empty-card">
          {verdicts.length === 0 ? 'No verdicts logged yet.' : 'No verdicts match your filters.'}
        </div>
      ) : (
        <div className="verdict-list">
          {filteredVerdicts.map((verdict) => {
            const isSaving = verdictSavingId === verdict.id
            const isRegenerating = verdictRegeneratingId === verdict.id
            const isBusy = isSaving || isRegenerating
            return (
              <GlassCard key={verdict.id} className="verdict-card">
                <div
                  className="verdict-card-clickable"
                  onClick={() => {
                    analytics.trackVerdictDetailOpened(verdict.predicted_outcome ?? 'unknown')
                    onSelectVerdict(verdict)
                  }}
                  onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter') {
                      analytics.trackVerdictDetailOpened(verdict.predicted_outcome ?? 'unknown')
                      onSelectVerdict(verdict)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div>
                    <span className="stat-label">Item </span>
                    <span className="stat-value">{verdict.candidate_title}</span>
                  </div>
                  <div className="verdict-meta">
                    <span>
                      Price:{' '}
                      {formatCurrency(verdict.candidate_price)}
                    </span>
                    <span>Vendor: {verdict.candidate_vendor ?? '—'}</span>
                    <span>Category: {verdict.candidate_category ?? '—'}</span>
                    <span>Recommendation: {verdict.predicted_outcome ?? '—'}</span>
                    <span>
                      Date: {formatDate(verdict.created_at)}
                    </span>
                  </div>
                </div>
                <div className="verdict-actions">
                  <div className="verdict-actions-links">
                    <LiquidButton
                      type="button"
                      className="link"
                      onClick={() => onShareVerdict(verdict)}
                    >
                      Share
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className="link"
                      onClick={() => onRegenerateVerdict(verdict)}
                      disabled={verdictRegeneratingId !== null || isBusy}
                    >
                      {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                    </LiquidButton>
                  </div>
                  <div className="verdict-feedback-buttons">
                    <button
                      type="button"
                      className={`feedback-btn feedback-up ${verdict.verdict_feedback === 1 ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onFeedback(verdict, 1) }}
                      disabled={isBusy}
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
                      onClick={(e) => { e.stopPropagation(); onFeedback(verdict, -1) }}
                      disabled={isBusy}
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
                      onClick={() => onDecision(verdict.id, 'bought')}
                      disabled={isBusy}
                    >
                      Bought
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className={`decision-btn hold ${verdict.user_decision === 'hold' ? 'active' : ''}`}
                      onClick={() => onDecision(verdict.id, 'hold')}
                      disabled={isBusy}
                    >
                      Hold {holdDurationHours}h
                    </LiquidButton>
                    <LiquidButton
                      type="button"
                      className={`decision-btn skip ${verdict.user_decision === 'skip' ? 'active' : ''}`}
                      onClick={() => onDecision(verdict.id, 'skip')}
                      disabled={isBusy}
                    >
                      Skip
                    </LiquidButton>
                  </div>
                  <LiquidButton
                    type="button"
                    className="link danger"
                    onClick={() => onDeleteVerdict(verdict.id)}
                    disabled={isBusy}
                  >
                    Delete
                  </LiquidButton>
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
