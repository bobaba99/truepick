import type { UserPreferences } from '../constants/userTypes'
import { resolveBrowserLocale } from './userPreferences'

const FALLBACK_LOCALE = 'en-US'
const FALLBACK_CURRENCY = 'USD'

const parseDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatCurrencyAmount = (
  amount: number | null | undefined,
  preferences: UserPreferences,
  locale = resolveBrowserLocale(),
  emptyValue = '—',
) => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return emptyValue
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: preferences.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat(FALLBACK_LOCALE, {
      style: 'currency',
      currency: FALLBACK_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
}

export const formatDateValue = (
  value: string | Date | null | undefined,
  locale = resolveBrowserLocale(),
  options?: Intl.DateTimeFormatOptions,
  emptyValue = '—',
) => {
  const date = parseDate(value)
  if (!date) {
    return emptyValue
  }

  try {
    return new Intl.DateTimeFormat(locale, options).format(date)
  } catch {
    return new Intl.DateTimeFormat(FALLBACK_LOCALE, options).format(date)
  }
}

export const formatDateTimeValue = (
  value: string | Date | null | undefined,
  locale = resolveBrowserLocale(),
  emptyValue = '—',
) => {
  const date = parseDate(value)
  if (!date) {
    return emptyValue
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(FALLBACK_LOCALE, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }
}
