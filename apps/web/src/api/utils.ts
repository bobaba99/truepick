export const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

export const clamp01 = (value: number) => clamp(value, 0, 1)

export type PriceTier = 'high' | 'medium' | 'low'

const DEFAULT_HIGH_THRESHOLD = 800
const DEFAULT_MEDIUM_THRESHOLD = 400

export const computePriceThresholds = (weeklyBudget: number | null) => {
  if (!weeklyBudget || weeklyBudget <= 0) {
    return { high: DEFAULT_HIGH_THRESHOLD, medium: DEFAULT_MEDIUM_THRESHOLD }
  }
  const monthlyBudget = weeklyBudget * 4
  return { high: monthlyBudget * 0.8, medium: monthlyBudget * 0.4 }
}

export const classifyPriceTier = (
  price: number | null,
  weeklyBudget: number | null
): PriceTier => {
  if (price === null) return 'low'
  const { high, medium } = computePriceThresholds(weeklyBudget)
  if (price >= high) return 'high'
  if (price >= medium) return 'medium'
  return 'low'
}

export const cosineSimilarity = (a: number[], b: number[]) => {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Average adult reading speed (source: Medium.com reading time standard)
const WORDS_PER_MINUTE = 200

/**
 * Strips HTML tags from a string using regex
 * @param html - HTML string to strip
 * @returns Plain text without HTML tags
 */
const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ')
}

/**
 * Calculates estimated reading time based on word count
 * @param title - Article title
 * @param summary - Article summary
 * @param bodyMarkdown - Article body in markdown format
 * @returns Estimated reading time in minutes (minimum 1 minute)
 */
export const calculateReadingTime = (
  title: string,
  summary: string,
  bodyMarkdown: string
): number => {
  const text = `${title} ${summary} ${stripHtml(bodyMarkdown)}`
  const wordCount = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE))
}
