import { Link } from 'react-router-dom'
import type { OnboardingIconKey } from './onboardingContent'
import { getOnboardingIcon } from './OnboardingIcons'
import { LiquidButton } from '../Kinematics'

type OnboardingStepProps = {
  iconKey: OnboardingIconKey
  title: string
  body: string
  ctaLabel?: string
  onCtaClick?: () => void
  privacyLink?: boolean
}

export default function OnboardingStep({
  iconKey,
  title,
  body,
  ctaLabel,
  onCtaClick,
  privacyLink,
}: OnboardingStepProps) {
  return (
    <div className="onboarding-step">
      <div className="onboarding-step-icon">{getOnboardingIcon(iconKey)}</div>
      <h2 className="onboarding-step-title">{title}</h2>
      <p className="onboarding-step-body">{body}</p>

      {ctaLabel && onCtaClick && (
        <LiquidButton
          type="button"
          className="onboarding-step-cta"
          onClick={onCtaClick}
        >
          {ctaLabel}
        </LiquidButton>
      )}

      {privacyLink && (
        <Link to="/privacy" className="onboarding-privacy-link">
          Read our full privacy policy
        </Link>
      )}
    </div>
  )
}
