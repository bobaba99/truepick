import type { OnboardingAnswers, UserPreferences } from '../../api/core/types'

export type ProfileTab = 'profile' | 'verdicts' | 'purchases' | 'settings'

export const VALID_TABS: readonly ProfileTab[] = ['profile', 'verdicts', 'purchases', 'settings'] as const

export const isProfileTab = (value: string | null): value is ProfileTab =>
  value !== null && (VALID_TABS as readonly string[]).includes(value)

export const PURCHASE_PAGE_SIZE = 5

export const coreValueOptions = [
  'Financial stability',
  'Minimalism / low clutter',
  'Emotional wellbeing',
  'Self-improvement',
  'Ethical consumption',
  'Aesthetic enjoyment',
  'Convenience',
  'Status / image',
  'Experiences over objects',
]

export const regretPatternOptions = [
  'I bought impulsively',
  "It didn't get used",
  "It didn't match who I am",
  'It was too expensive for what it gave',
  'It was driven by stress, boredom, or FOMO',
  'It duplicated something I already had',
]

export const satisfactionPatternOptions = [
  'Improves my daily routine',
  'Lasts a long time',
  'Supports my growth or habits',
  'Makes life calmer or easier',
  'Reflects my identity',
  'Saves time or energy',
]

export const decisionStyleOptions = [
  'I plan carefully and delay',
  'I think briefly, then decide',
  'I often buy emotionally and justify later',
  'It depends heavily on mood',
]

export const materialismItems = [
  {
    key: 'centrality',
    prompt: 'Do you think it\u2019s important to own expensive things?',
  },
  {
    key: 'happiness',
    prompt: 'Does buying expensive things make you happy?',
  },
  {
    key: 'success',
    prompt: 'Do you like people who have expensive things more than you like other people?',
  },
] as const

export const locusOfControlItems = [
  {
    key: 'workHard',
    prompt: 'If I work hard, I will succeed.',
  },
  {
    key: 'destiny',
    prompt: 'Destiny often gets in the way of my plans.',
  },
] as const

export const identityStabilityOptions = [
  'Not important',
  'Somewhat important',
  'Very important',
]

export const themeModeOptions: Array<{ value: UserPreferences['theme']; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export const DEFAULT_ONBOARDING: OnboardingAnswers = {
  coreValues: [],
  regretPatterns: [],
  satisfactionPatterns: [],
  decisionStyle: '',
  neuroticismScore: 3,
  materialism: {
    centrality: 2,
    happiness: 2,
    success: 2,
  },
  locusOfControl: {
    workHard: 3,
    destiny: 3,
  },
  identityStability: '',
}

export const normalizeOnboardingAnswers = (
  answers: OnboardingAnswers | null | undefined,
): OnboardingAnswers => {
  if (!answers) return DEFAULT_ONBOARDING
  return {
    ...DEFAULT_ONBOARDING,
    ...answers,
    coreValues: answers.coreValues ?? [],
    regretPatterns: answers.regretPatterns ?? [],
    satisfactionPatterns: answers.satisfactionPatterns ?? [],
    materialism: {
      ...DEFAULT_ONBOARDING.materialism,
      ...answers.materialism,
    },
    locusOfControl: {
      ...DEFAULT_ONBOARDING.locusOfControl,
      ...answers.locusOfControl,
    },
  }
}
