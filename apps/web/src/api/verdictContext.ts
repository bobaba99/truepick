import { supabase } from './supabaseClient'
import type { OnboardingAnswers, PurchaseInput, ScoreExplanation, VendorMatch } from './types'
import { getEmbeddings } from './embeddingService'
import { cosineSimilarity } from './utils'
import { buildScore } from './verdictScoring'

type PurchaseWithSwipe = {
  id: string
  title: string
  price: number
  category: string | null
  vendor: string | null
  purchase_date: string
  verdict_id: string | null
  swipes: { outcome: string }[]
  verdicts: { justification: string | null } | null
}

const VENDOR_SELECT_FIELDS =
  'vendor_id, vendor_name, vendor_category, vendor_quality, vendor_reliability, vendor_price_tier'

const CATEGORY_VENDOR_MAP: Record<string, string> = {
  home_goods: 'home goods',
  health_wellness: 'health & wellness',
  food_beverage: 'food & beverage',
}

const normalizeVendorCategory = (category: string | null | undefined) => {
  if (!category) return null
  const normalized = category.trim().toLowerCase()
  return CATEGORY_VENDOR_MAP[normalized] ?? normalized
}

const fetchVendorMatch = async (
  vendorName: string,
  vendorCategory: string | null
) => {
  let query = supabase
    .from('vendors')
    .select(VENDOR_SELECT_FIELDS)
    .ilike('vendor_name', vendorName)

  if (vendorCategory) {
    query = query.eq('vendor_category', vendorCategory)
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    return null
  }

  return (data ?? null) as VendorMatch | null
}

export const retrieveVendorMatch = async (
  input: PurchaseInput
): Promise<VendorMatch | null> => {
  const vendorName = input.vendor?.trim()
  if (!vendorName) return null

  const vendorCategory = normalizeVendorCategory(input.category)
  let match = await fetchVendorMatch(vendorName, vendorCategory)

  if (!match && vendorCategory) {
    match = await fetchVendorMatch(vendorName, null)
  }

  if (!match) {
    const { data, error } = await supabase
      .from('vendors')
      .select(VENDOR_SELECT_FIELDS)
      .ilike('vendor_name', `%${vendorName}%`)
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      match = data as VendorMatch
    }
  }

  return match
}

const formatPurchaseString = (purchase: PurchaseWithSwipe): string => {
  const outcome = purchase.swipes?.[0]?.outcome ?? 'not rated'
  const motive = purchase.verdicts?.justification
  const parts = [
    `- ${purchase.title}`,
    `$${Number(purchase.price).toFixed(2)}`,
    purchase.category ?? 'uncategorized',
    purchase.vendor ?? 'unknown vendor',
    outcome,
  ]
  if (motive) {
    parts.push(`"${motive}"`)
  }
  return parts.join(' | ')
}

const buildPurchaseEmbeddingText = (purchase: PurchaseWithSwipe) => {
  const parts = [
    purchase.title,
    purchase.category ?? '',
    purchase.vendor ?? '',
    purchase.verdicts?.justification ?? '',
  ]
  return parts
    .filter(Boolean)
    .join(' | ')
    .slice(0, 500)
}

const buildQueryEmbeddingText = (input: PurchaseInput) => {
  const parts = [
    input.title,
    input.category ?? '',
    input.vendor ?? '',
    input.justification ?? '',
  ]
  return parts
    .filter(Boolean)
    .join(' | ')
    .slice(0, 500)
}

const fetchPurchaseContext = async (userId: string) => {
  const { data, error } = await supabase
    .from('purchases')
    .select(
      `
      id, title, price, category, vendor, purchase_date, verdict_id,
      swipes (outcome),
      verdicts (justification)
    `
    )
    .eq('user_id', userId)
    .order('purchase_date', { ascending: false })
    .limit(40)

  if (error || !data || data.length === 0) {
    return [] as PurchaseWithSwipe[]
  }

  return data as unknown as PurchaseWithSwipe[]
}

export async function retrieveSimilarPurchases(
  userId: string,
  input: PurchaseInput,
  limit = 5,
  openaiApiKey?: string
): Promise<string> {
  const purchases = await fetchPurchaseContext(userId)

  if (purchases.length === 0) {
    return 'No similar purchases found.'
  }

  if (!openaiApiKey) {
    if (!input.category) {
      return 'No category specified for comparison.'
    }
    const categoryMatches = purchases.filter(
      (purchase) => purchase.category === input.category
    )
    if (categoryMatches.length === 0) {
      return 'No similar purchases found.'
    }
    const lines = categoryMatches.slice(0, limit).map(formatPurchaseString)
    return `Similar purchases in "${input.category}":\n${lines.join('\n')}`
  }

  try {
    const queryText = buildQueryEmbeddingText(input)
    const purchaseTexts = purchases.map(buildPurchaseEmbeddingText)
    const embeddings = await getEmbeddings(openaiApiKey, [queryText, ...purchaseTexts])
    const queryEmbedding = embeddings[0]
    const scored = purchases.map((purchase, index) => ({
      purchase,
      score: cosineSimilarity(queryEmbedding, embeddings[index + 1]),
    }))

    const topMatches = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((match) => match.purchase)

    if (topMatches.length === 0) {
      return 'No similar purchases found.'
    }

    const lines = topMatches.map(formatPurchaseString)
    return `Similar purchases (semantic match):\n${lines.join('\n')}`
  } catch (embeddingError) {
    console.warn('Embedding lookup failed, falling back to category match.', embeddingError)
    if (!input.category) {
      return 'No category specified for comparison.'
    }
    const categoryMatches = purchases.filter(
      (purchase) => purchase.category === input.category
    )
    if (categoryMatches.length === 0) {
      return 'No similar purchases found.'
    }
    const lines = categoryMatches.slice(0, limit).map(formatPurchaseString)
    return `Similar purchases in "${input.category}":\n${lines.join('\n')}`
  }
}

export async function retrieveRecentPurchases(
  userId: string,
  limit = 5
): Promise<string> {
  const { data, error } = await supabase
    .from('purchases')
    .select(
      `
      id, title, price, category, vendor, purchase_date, verdict_id,
      swipes (outcome),
      verdicts (justification)
    `
    )
    .eq('user_id', userId)
    .order('purchase_date', { ascending: false })
    .limit(limit)

  if (error || !data || data.length === 0) {
    return 'No purchase history found.'
  }

  const purchases = data as unknown as PurchaseWithSwipe[]
  const lines = purchases.map(formatPurchaseString)
  return `Recent purchases:\n${lines.join('\n')}`
}

export async function retrieveUserProfileContext(userId: string): Promise<string> {
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('profile_summary, onboarding_answers, weekly_fun_budget')
    .eq('id', userId)
    .maybeSingle()

  const summary = profile?.profile_summary?.trim()
  const budget =
    profile?.weekly_fun_budget !== null && profile?.weekly_fun_budget !== undefined
      ? `$${profile.weekly_fun_budget.toFixed(2)}`
      : null

  const contextParts: string[] = []

  if (!profileError) {
    if (summary) {
      contextParts.push(`Profile summary:\n- ${summary}`)
    }
    if (budget) {
      contextParts.push(`Weekly fun budget:\n- ${budget}`)
    }
    const onboarding = profile?.onboarding_answers as OnboardingAnswers | null | undefined
    if (onboarding) {
      const onboardingLines: string[] = []
      if (onboarding.coreValues?.length) {
        onboardingLines.push(`- Core values: ${onboarding.coreValues.join(', ')}`)
      }
      if (onboarding.regretPatterns?.length) {
        onboardingLines.push(`- Regret patterns: ${onboarding.regretPatterns.join(', ')}`)
      }
      if (onboarding.satisfactionPatterns?.length) {
        onboardingLines.push(
          `- Satisfaction patterns: ${onboarding.satisfactionPatterns.join(', ')}`
        )
      }
      if (onboarding.decisionStyle) {
        onboardingLines.push(`- Decision style: ${onboarding.decisionStyle}`)
      }
      if (onboarding.financialSensitivity) {
        onboardingLines.push(`- Financial sensitivity: ${onboarding.financialSensitivity}`)
      }
      if (typeof onboarding.spendingStressScore === 'number') {
        onboardingLines.push(`- Spending stress score: ${onboarding.spendingStressScore}/5`)
      }
      if (onboarding.identityStability) {
        onboardingLines.push(`- Identity stability: ${onboarding.identityStability}`)
      }
      if (onboarding.emotionalRelationship) {
        const { stability, excitement, control, reward } = onboarding.emotionalRelationship
        onboardingLines.push(
          `- Emotional relationship: stability ${stability}/5, excitement ${excitement}/5, control ${control}/5, reward ${reward}/5`
        )
      }
      if (onboardingLines.length > 0) {
        contextParts.push(`Onboarding answers:\n${onboardingLines.join('\n')}`)
      }
    }
  }

  if (contextParts.length === 0) {
    contextParts.push('Profile summary: not set.')
    return contextParts.join('\n\n')
  }

  return contextParts.join('\n\n')
}

export async function computePatternRepetition(
  userId: string,
  category: string | null
): Promise<ScoreExplanation> {
  if (!category) {
    return buildScore(0, 'No category provided for pattern comparison.')
  }

  const { data, error } = await supabase
    .from('swipes')
    .select('outcome, purchases!inner(category)')
    .eq('user_id', userId)
    .eq('purchases.category', category)
    .limit(20)

  if (error || !data || data.length === 0) {
    return buildScore(0, 'No similar purchase swipes found.')
  }

  const scores = data.map((row) => {
    switch (row.outcome) {
      case 'regret':
        return 0
      case 'not_sure':
        return 0.5
      case 'satisfied':
        return 1
      default:
        return 0
    }
  })

  const mean =
    scores.reduce<number>((sum, value) => sum + value, 0) / scores.length
  return buildScore(mean, 'Average similarity-weighted reflection score.')
}
