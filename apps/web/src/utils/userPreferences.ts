import type {
  HoldDurationHours,
  ThemeMode,
  UserPreferences,
} from '../constants/userTypes'

export const DEFAULT_THEME_MODE: ThemeMode = 'light'
export const DEFAULT_LOCALE = 'en-US'
export const DEFAULT_CURRENCY = 'USD'
export const DEFAULT_HOLD_DURATION_HOURS: HoldDurationHours = 24
export const DEFAULT_HOLD_REMINDERS_ENABLED = true

const HOLD_DURATION_VALUES: HoldDurationHours[] = [24, 48, 72]

export const HOLD_DURATION_OPTIONS: Array<{
  value: HoldDurationHours
  label: string
}> = [
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 72, label: '72 hours' },
]

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
] as const

const REGION_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  JP: 'JPY',
  CN: 'CNY',
  IN: 'INR',
  SG: 'SGD',
  CH: 'CHF',
  FR: 'EUR',
  DE: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
}

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark'

const isHoldDurationHours = (value: unknown): value is HoldDurationHours =>
  typeof value === 'number' && HOLD_DURATION_VALUES.includes(value as HoldDurationHours)

const isValidLocale = (locale: string) => {
  try {
    new Intl.NumberFormat(locale)
    return true
  } catch {
    return false
  }
}

const isValidCurrency = (currency: string, locale: string) => {
  try {
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(1)
    return true
  } catch {
    return false
  }
}

export const resolveBrowserLocale = () => {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LOCALE
  }

  const candidate = navigator.languages?.[0] ?? navigator.language ?? DEFAULT_LOCALE
  return isValidLocale(candidate) ? candidate : DEFAULT_LOCALE
}

export const inferCurrencyFromLocale = (locale: string) => {
  let region = ''

  try {
    region = new Intl.Locale(locale).region ?? ''
  } catch {
    const match = locale.match(/[-_]([A-Za-z]{2})$/)
    region = match?.[1]?.toUpperCase() ?? ''
  }

  return REGION_TO_CURRENCY[region] ?? DEFAULT_CURRENCY
}

export const buildDefaultUserPreferences = (
  localeOverride?: string,
): UserPreferences => {
  const localeCandidate = localeOverride ?? resolveBrowserLocale()
  const locale = isValidLocale(localeCandidate) ? localeCandidate : DEFAULT_LOCALE

  return {
    theme: DEFAULT_THEME_MODE,
    currency: inferCurrencyFromLocale(locale),
    hold_duration_hours: DEFAULT_HOLD_DURATION_HOURS,
    hold_reminders_enabled: DEFAULT_HOLD_REMINDERS_ENABLED,
  }
}

export const normalizeUserPreferences = (
  raw: unknown,
  localeOverride?: string,
): UserPreferences => {
  const defaults = buildDefaultUserPreferences(localeOverride)

  if (!raw || typeof raw !== 'object') {
    return defaults
  }

  const source = raw as Partial<UserPreferences> & { locale?: unknown }
  const legacyLocale =
    typeof source.locale === 'string' && isValidLocale(source.locale)
      ? source.locale
      : resolveBrowserLocale()

  const currencyCandidate =
    typeof source.currency === 'string' ? source.currency.trim().toUpperCase() : ''
  const currency =
    currencyCandidate.length === 3 && isValidCurrency(currencyCandidate, legacyLocale)
      ? currencyCandidate
      : inferCurrencyFromLocale(legacyLocale)

  const holdDurationCandidate =
    typeof source.hold_duration_hours === 'number'
      ? source.hold_duration_hours
      : typeof source.hold_duration_hours === 'string'
        ? Number(source.hold_duration_hours)
        : null
  const holdDuration = isHoldDurationHours(holdDurationCandidate)
    ? holdDurationCandidate
    : defaults.hold_duration_hours

  const holdRemindersEnabled =
    typeof source.hold_reminders_enabled === 'boolean'
      ? source.hold_reminders_enabled
      : defaults.hold_reminders_enabled

  return {
    theme: isThemeMode(source.theme) ? source.theme : defaults.theme,
    currency,
    hold_duration_hours: holdDuration,
    hold_reminders_enabled: holdRemindersEnabled,
  }
}
