export const DAILY_LIMIT = 3
export const JUSTIFICATION_WORD_MIN = 10
export const JUSTIFICATION_WORD_MAX = 30
export const JUSTIFICATION_GUIDANCE_ROTATION_MS = 3200
export const JUSTIFICATION_GUIDANCE_FADE_MS = 220
export const JUSTIFICATION_PLACEHOLDERS = [
  'What problem does this solve right now?',
  'Why do you need this now instead of later?',
  'What happens if you do not buy it this week?',
  'Is this replacing something essential or adding something new?',
]

export function getNextUtcMidnight(from: number): Date {
  const next = new Date(from)
  next.setUTCHours(24, 0, 0, 0)
  return next
}

export function countWords(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export function outcomeLabel(outcome: string | null): string {
  if (outcome === 'buy') return 'Buy'
  if (outcome === 'hold') return 'Hold'
  return 'Skip'
}
