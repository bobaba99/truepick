import type { ReactNode } from 'react'
import type { OnboardingIconKey } from './onboardingContent'

const iconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: '100%',
  height: '100%',
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function WelcomeIcon() {
  return (
    <svg {...iconProps}>
      {/* Shield outline */}
      <path d="M24 4L6 12v12c0 11 8 17 18 20 10-3 18-9 18-20V12L24 4z" />
      {/* Checkmark */}
      <path d="M16 24l6 6 10-12" strokeWidth={2.5} />
    </svg>
  )
}

function VerdictIcon() {
  return (
    <svg {...iconProps}>
      {/* Brain outline (left hemisphere) */}
      <path d="M24 6c-7 0-13 5-13 12 0 4 2 7 5 9v7a2 2 0 002 2h6" />
      {/* Brain outline (right hemisphere) */}
      <path d="M24 6c7 0 13 5 13 12 0 4-2 7-5 9v7a2 2 0 01-2 2h-6" />
      {/* Neural connections */}
      <path d="M18 18h12M15 24h18" strokeWidth={1.5} strokeDasharray="3 2" />
      {/* Center dot */}
      <circle cx={24} cy={18} r={2} fill="currentColor" stroke="none" />
    </svg>
  )
}

function QuizIcon() {
  return (
    <svg {...iconProps}>
      {/* Clipboard body */}
      <rect x={10} y={8} width={28} height={34} rx={3} />
      {/* Clipboard clip */}
      <path d="M18 4h12v6H18z" />
      <line x1={18} y1={4} x2={30} y2={4} strokeWidth={3} />
      {/* Checklist lines */}
      <line x1={20} y1={20} x2={32} y2={20} />
      <line x1={20} y1={27} x2={32} y2={27} />
      <line x1={20} y1={34} x2={28} y2={34} />
      {/* Check marks */}
      <path d="M14 19l2 2 3-3" strokeWidth={1.5} />
      <path d="M14 26l2 2 3-3" strokeWidth={1.5} />
      <circle cx={16} cy={34} r={1.5} fill="currentColor" stroke="none" />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg {...iconProps}>
      {/* Envelope body */}
      <rect x={6} y={12} width={36} height={26} rx={3} />
      {/* Envelope flap */}
      <path d="M6 15l18 12 18-12" />
      {/* Import arrow */}
      <path d="M24 4v14" strokeWidth={2.5} />
      <path d="M19 9l5-5 5 5" strokeWidth={2.5} />
    </svg>
  )
}

function PrivacyIcon() {
  return (
    <svg {...iconProps}>
      {/* Lock body */}
      <rect x={12} y={22} width={24} height={18} rx={3} />
      {/* Lock shackle */}
      <path d="M16 22v-6a8 8 0 0116 0v6" />
      {/* Keyhole */}
      <circle cx={24} cy={31} r={3} fill="currentColor" stroke="none" />
      <line x1={24} y1={34} x2={24} y2={37} strokeWidth={2.5} />
    </svg>
  )
}

const ICON_MAP: Record<OnboardingIconKey, () => ReactNode> = {
  welcome: WelcomeIcon,
  verdict: VerdictIcon,
  quiz: QuizIcon,
  email: EmailIcon,
  privacy: PrivacyIcon,
}

export function getOnboardingIcon(key: OnboardingIconKey): ReactNode {
  const Icon = ICON_MAP[key]
  return <Icon />
}
