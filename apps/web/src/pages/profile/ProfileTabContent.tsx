import type { OnboardingAnswers } from '../../api/core/types'
import { GlassCard, LiquidButton } from '../../components/Kinematics'

type ProfileTabContentProps = {
  profileSummary: string
  weeklyFunBudget: string
  onboardingAnswers: OnboardingAnswers
  materialismAverage: number
  locusSummary: string
  profileDetailExpanded: boolean
  onToggleDetail: () => void
  onEditProfile: () => void
  formatCurrency: (value: number) => string
}

export default function ProfileTabContent({
  profileSummary,
  weeklyFunBudget,
  onboardingAnswers,
  materialismAverage,
  locusSummary,
  profileDetailExpanded,
  onToggleDetail,
  onEditProfile,
  formatCurrency,
}: ProfileTabContentProps) {
  return (
    <>
      <div className="profile-summary-card">
        <div className="profile-summary-row">
          <div>
            <span className="label">Personal summary</span>
            <br />
            <span className="value">{profileSummary || 'Not set'}</span>
          </div>
          <div>
            <span className="label">Weekly fun budget</span>
            <br />
            <span className="value">
              {weeklyFunBudget ? formatCurrency(Number(weeklyFunBudget)) : 'Not set'}
            </span>
          </div>
        </div>
        <div className="profile-summary-actions">
          <LiquidButton
            type="button"
            className="ghost"
            onClick={onEditProfile}
          >
            Edit Decision Profile
          </LiquidButton>
          <LiquidButton
            type="button"
            className="ghost"
            onClick={onToggleDetail}
          >
            {profileDetailExpanded ? 'Hide details' : 'View full profile'}
          </LiquidButton>
        </div>
      </div>

      <div className={`collapsible ${profileDetailExpanded ? 'open' : ''}`}>
        <div>
          <div className="profile-detail-sections">
            <div className="profile-detail-group">
              <h3 className="profile-group-label">What I value</h3>
              <div className="profile-answer-grid">
                <GlassCard className="profile-answer">
                  <span className="label">Core values</span>
                  <span className="value">
                    {onboardingAnswers.coreValues.length > 0
                      ? onboardingAnswers.coreValues.join(', ')
                      : 'Not set'}
                  </span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Satisfaction pattern</span>
                  <span className="value">
                    {onboardingAnswers.satisfactionPatterns.length > 0
                      ? onboardingAnswers.satisfactionPatterns.join(', ')
                      : 'Not set'}
                  </span>
                </GlassCard>
              </div>
            </div>

            <div className="profile-detail-group">
              <h3 className="profile-group-label">What I avoid</h3>
              <div className="profile-answer-grid">
                <GlassCard className="profile-answer">
                  <span className="label">Regret triggers</span>
                  <span className="value">
                    {onboardingAnswers.regretPatterns.length > 0
                      ? onboardingAnswers.regretPatterns.join(', ')
                      : 'Not set'}
                  </span>
                </GlassCard>
              </div>
            </div>

            <div className="profile-detail-group">
              <h3 className="profile-group-label">Decision psychology</h3>
              <div className="profile-answer-grid">
                <GlassCard className="profile-answer">
                  <span className="label">Decision approach</span>
                  <span className="value">
                    {onboardingAnswers.decisionStyle || 'Not set'}
                  </span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Stress response</span>
                  <span className="value">{onboardingAnswers.neuroticismScore}/5</span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Views on expensive things</span>
                  <span className="value">{materialismAverage.toFixed(1)}/4</span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Sense of control</span>
                  <span className="value">{locusSummary}</span>
                </GlassCard>
                <GlassCard className="profile-answer">
                  <span className="label">Identity alignment</span>
                  <span className="value">
                    {onboardingAnswers.identityStability || 'Not set'}
                  </span>
                </GlassCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
