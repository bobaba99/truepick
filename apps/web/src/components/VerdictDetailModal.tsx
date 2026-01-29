import type { VerdictRow } from '../api/types'
import { sanitizeVerdictRationaleHtml } from '../utils/sanitizeHtml'

type VerdictDetailModalProps = {
  verdict: VerdictRow
  isOpen: boolean
  onClose: () => void
}

type ReasoningData = {
  valueConflict?: {
    score: number
    explanation: string
  }
  patternRepetition?: {
    score: number
    explanation: string
  }
  emotionalImpulse?: {
    score: number
    explanation: string
  }
  financialStrain?: {
    score: number
    explanation: string
  }
  longTermUtility?: {
    score: number
    explanation: string
  }
  emotionalSupport?: {
    score: number
    explanation: string
  }
  decisionScore?: number
  rationale?: string
  importantPurchase?: boolean
  valueConflictScore?: {
    score: number
    explanation: string
  }
  patternRepetitionRisk?: {
    score: number
    explanation: string
  }
}

export default function VerdictDetailModal({
  verdict,
  isOpen,
  onClose,
}: VerdictDetailModalProps) {
  if (!isOpen) return null

  const reasoning = verdict.reasoning as ReasoningData | null
  const isImportant = reasoning?.importantPurchase === true

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2>{verdict.candidate_title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="verdict-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Recommendation</span>
              <span
                className={`detail-value outcome-badge outcome-${verdict.predicted_outcome}`}
              >
                {verdict.predicted_outcome === 'buy' && '✓ Buy'}
                {verdict.predicted_outcome === 'hold' && '⏸ Hold'}
                {verdict.predicted_outcome === 'skip' && '✗ Skip'}
              </span>
            </div>

            {verdict.candidate_price !== null && (
              <div className="detail-item">
                <span className="detail-label">Price</span>
                <span className="detail-value">
                  ${verdict.candidate_price.toFixed(2)}
                </span>
              </div>
            )}

            {verdict.candidate_category && (
              <div className="detail-item">
                <span className="detail-label">Category</span>
                <span className="detail-value">{verdict.candidate_category}</span>
              </div>
            )}

            {verdict.candidate_vendor && (
              <div className="detail-item">
                <span className="detail-label">Vendor</span>
                <span className="detail-value">{verdict.candidate_vendor}</span>
              </div>
            )}

            {verdict.scoring_model && (
              <div className="detail-item">
                <span className="detail-label">Scoring model</span>
                <span className="detail-value">
                  {verdict.scoring_model === 'cost_sensitive_iso'
                    ? 'Cost-sensitive isotonic'
                    : 'Standard logistic'}
                </span>
              </div>
            )}

            {verdict.created_at && (
              <div className="detail-item">
                <span className="detail-label">Created</span>
                <span className="detail-value">
                  {new Date(verdict.created_at).toLocaleString()}
                </span>
              </div>
            )}

            {isImportant && (
              <div className="detail-item">
                <span className="detail-label">Important</span>
                <span className="detail-value important-badge">Important</span>
              </div>
            )}
          </div>

          {verdict.justification && (
            <div className="detail-section">
              <h3>Your Justification</h3>
              <p className="detail-text">{verdict.justification}</p>
            </div>
          )}

          {reasoning && (
            <div className="detail-section">
              <h3>AI Analysis</h3>

              <div className="analysis-grid">
                {(reasoning.valueConflict ?? reasoning.valueConflictScore) && (
                  <div className="analysis-item analysis-card">
                    <div className="analysis-header">
                      <span className="analysis-label">Value Conflict Score</span>
                    </div>
                    <span className="analysis-score">
                      {(reasoning.valueConflict ?? reasoning.valueConflictScore)?.score.toFixed(2)}
                    </span>
                    <p className="analysis-explanation">
                      {(reasoning.valueConflict ?? reasoning.valueConflictScore)?.explanation}
                    </p>
                  </div>
                )}

                {(reasoning.patternRepetition ?? reasoning.patternRepetitionRisk) && (
                  <div className="analysis-item analysis-card">
                    <div className="analysis-header">
                      <span className="analysis-label">Pattern Repetition Risk</span>
                    </div>
                    <span className="analysis-score">
                      {(reasoning.patternRepetition ?? reasoning.patternRepetitionRisk)?.score.toFixed(2)}
                    </span>
                    <p className="analysis-explanation">
                      {(reasoning.patternRepetition ?? reasoning.patternRepetitionRisk)?.explanation}
                    </p>
                  </div>
                )}

                {reasoning.emotionalImpulse && (
                  <div className="analysis-item analysis-card">
                    <div className="analysis-header">
                      <span className="analysis-label">Emotional Impulse</span>
                    </div>
                    <span className="analysis-score">
                      {reasoning.emotionalImpulse.score.toFixed(2)}
                    </span>
                    <p className="analysis-explanation">
                      {reasoning.emotionalImpulse.explanation}
                    </p>
                  </div>
                )}

                {reasoning.financialStrain && (
                  <div className="analysis-item analysis-card">
                    <div className="analysis-header">
                      <span className="analysis-label">Financial Strain</span>
                    </div>
                    <span className="analysis-score">
                      {reasoning.financialStrain.score.toFixed(2)}
                    </span>
                    <p className="analysis-explanation">
                      {reasoning.financialStrain.explanation}
                    </p>
                  </div>
                )}

                {reasoning.longTermUtility && (
                  <div className="analysis-item analysis-card">
                    <div className="analysis-header">
                      <span className="analysis-label">Long-Term Utility</span>
                    </div>
                    <span className="analysis-score">
                      {reasoning.longTermUtility.score.toFixed(2)}
                    </span>
                    <p className="analysis-explanation">
                      {reasoning.longTermUtility.explanation}
                    </p>
                  </div>
                )}

                {reasoning.emotionalSupport && (
                  <div className="analysis-item analysis-card">
                    <div className="analysis-header">
                      <span className="analysis-label">Emotional Support</span>
                    </div>
                    <span className="analysis-score">
                      {reasoning.emotionalSupport.score.toFixed(2)}
                    </span>
                    <p className="analysis-explanation">
                      {reasoning.emotionalSupport.explanation}
                    </p>
                  </div>
                )}
              </div>

              {typeof reasoning.decisionScore === 'number' && (
                <div className="analysis-item analysis-item--decision">
                  <div className="analysis-header">
                    <span className="analysis-label">Decision Score</span>
                    <span className="analysis-score">{reasoning.decisionScore.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {reasoning.rationale && (
                <div className="analysis-item">
                  <div className="analysis-header">
                    <span className="analysis-label">Rationale</span>
                  </div>
                  <p
                    className="analysis-explanation"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeVerdictRationaleHtml(reasoning.rationale),
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {verdict.hold_release_at && (
            <div className="detail-section">
              <h3>Hold Information</h3>
              <p className="detail-text">
                Hold expires: {new Date(verdict.hold_release_at).toLocaleString()}
              </p>
            </div>
          )}

          {verdict.user_decision && (
            <div className="detail-section">
              <h3>Your Decision</h3>
              <p className="detail-text">
                <strong>{verdict.user_decision}</strong>
                {verdict.user_decision === 'hold' && verdict.user_hold_until && (
                  <> (until {new Date(verdict.user_hold_until).toLocaleString()})</>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
