export type OnboardingIconKey = 'welcome' | 'verdict' | 'quiz' | 'email' | 'privacy'

export type OnboardingStepData = {
  readonly id: string
  readonly iconKey: OnboardingIconKey
  readonly title: string
  readonly body: string
  readonly ctaLabel?: string
  readonly ctaRoute?: string
  readonly privacyLink?: boolean
}

export const ONBOARDING_STEPS: readonly OnboardingStepData[] = [
  {
    id: 'welcome',
    iconKey: 'welcome',
    title: 'Welcome to TruePick',
    body: 'TruePick helps you pause before impulse buys. Submit any product and get an instant AI-powered verdict: Buy, Hold, or Skip.',
  },
  {
    id: 'verdict',
    iconKey: 'verdict',
    title: 'How Verdicts Work',
    body: 'Our AI evaluates your purchase against your values, spending patterns, and purchase history to give a personalized recommendation.',
  },
  {
    id: 'quiz',
    iconKey: 'quiz',
    title: 'Sharpen Your Verdicts',
    body: 'Complete a short profile questionnaire to improve verdict accuracy. Your values, regret patterns, and decision style all help the AI.',
    ctaLabel: 'Take the quiz',
    ctaRoute: '/profile',
  },
  {
    id: 'email',
    iconKey: 'email',
    title: 'Import Purchase History',
    body: 'Connect Gmail or Outlook to import your purchase history. More context means better, more personalized verdicts.',
    ctaLabel: 'Connect email',
    ctaRoute: '/email-sync',
  },
  {
    id: 'privacy',
    iconKey: 'privacy',
    title: 'Your Data, Your Control',
    body: 'Your data stays yours. We never sell it, and you can delete everything anytime.',
    privacyLink: true,
  },
] as const
