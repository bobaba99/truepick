import { supabase } from '../core/supabaseClient'
import type {
  EvaluationResult,
  OnboardingAnswers,
  PurchaseInput,
  UserDecision,
  VerdictOutcome,
  VerdictRow,
} from '../core/types'
import {
  computePatternRepetition,
  retrieveRecentPurchases,
  retrieveSimilarPurchases,
  retrieveUserProfileContext,
  retrieveVendorMatch,
} from './verdictContext'
import { buildScore, computeFinancialStrain } from './verdictScoring'
import { clamp01 } from '../core/utils'
import { evaluateWithFallback, evaluateWithLlm, type EvaluationContext } from './verdictLLM'
import { logger } from '../core/logger'

const normalizeLikert = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return 0
  return clamp01((value - min) / (max - min))
}

const computeLocusOfControl = (
  locusData: { workHard: number; destiny: number } | null | undefined
): number => {
  if (!locusData) return 0
  const workHard = normalizeLikert(locusData.workHard, 1, 5)
  const destiny = normalizeLikert(locusData.destiny, 1, 5)
  return clamp01((workHard + (1 - destiny)) / 2)
}

const computePsychScores = (answers: OnboardingAnswers | null | undefined) => {
  if (!answers) {
    return { neuroticism: 0, materialism: 0, locusOfControl: 0 }
  }

  const neuroticism =
    typeof answers.neuroticismScore === 'number'
      ? normalizeLikert(answers.neuroticismScore, 1, 5)
      : 0

  const materialismValues = answers.materialism
    ? [answers.materialism.centrality, answers.materialism.happiness, answers.materialism.success]
    : []
  const materialismAverage =
    materialismValues.length > 0
      ? materialismValues.reduce((sum, value) => sum + value, 0) / materialismValues.length
      : null
  const materialism =
    materialismAverage !== null ? normalizeLikert(materialismAverage, 1, 4) : 0

  const locusOfControl = computeLocusOfControl(answers.locusOfControl)

  return { neuroticism, materialism, locusOfControl }
}

export async function getRecentVerdict(userId: string): Promise<VerdictRow | null> {
  const { data, error } = await supabase
    .from('verdicts')
    .select(
      'id, candidate_title, candidate_price, candidate_category, candidate_vendor, scoring_model, justification, predicted_outcome, confidence_score, reasoning, hold_release_at, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.warn('Failed to fetch recent verdict', { userId, error: error.message })
    return null
  }

  return (data as VerdictRow) ?? null
}

export async function getVerdictHistory(userId: string, limit = 10): Promise<VerdictRow[]> {
  const { data, error } = await supabase
    .from('verdicts')
    .select(
      'id, candidate_title, candidate_price, candidate_category, candidate_vendor, scoring_model, justification, predicted_outcome, confidence_score, reasoning, created_at, hold_release_at, user_proceeded, actual_outcome, user_decision, user_hold_until'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as VerdictRow[]
}

export async function updateVerdictDecision(
  userId: string,
  verdictId: string,
  decision: UserDecision
): Promise<{ error: string | null; isDuplicate: boolean }> {
  const userHoldUntil =
    decision === 'hold' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null

  const { data: verdict, error: fetchError } = await supabase
    .from('verdicts')
    .select(
      'candidate_title, candidate_price, candidate_category, candidate_vendor, user_decision, user_hold_until'
    )
    .eq('id', verdictId)
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  const previousDecision = verdict.user_decision

  if (previousDecision === 'bought' && decision !== 'bought') {
    const { error: deleteError } = await supabase
      .from('purchases')
      .delete()
      .eq('verdict_id', verdictId)

    if (deleteError) {
      return { error: deleteError.message }
    }
  }

  if (decision === 'bought' && previousDecision !== 'bought') {
    const now = new Date()
    const holdUntil = verdict.user_hold_until ? new Date(verdict.user_hold_until) : null
    const effectivePurchaseDate = holdUntil && holdUntil <= now ? holdUntil : now

    const { error: purchaseError } = await supabase.rpc('add_purchase', {
      p_title: verdict.candidate_title,
      p_price: verdict.candidate_price ?? 0,
      p_vendor: verdict.candidate_vendor,
      p_category: verdict.candidate_category,
      p_purchase_date: effectivePurchaseDate.toISOString().split('T')[0],
      p_source: 'verdict',
      p_verdict_id: verdictId,
    })

    if (purchaseError) {
      const isDuplicate =
        purchaseError.code === '23505' ||
        purchaseError.message.toLowerCase().includes('duplicate') ||
        purchaseError.details?.toLowerCase().includes('unique') ||
        purchaseError.details?.toLowerCase().includes('verdict_id') ||
        false

      if (isDuplicate) {
        return { error: null, isDuplicate: true }
      }

      return { error: purchaseError.message, isDuplicate: false }
    }
  }

  const { error } = await supabase
    .from('verdicts')
    .update({
      user_decision: decision,
      user_hold_until: userHoldUntil,
    })
    .eq('id', verdictId)
    .eq('user_id', userId)

  return { error: error?.message ?? null, isDuplicate: false }
}

export async function deleteVerdict(
  userId: string,
  verdictId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('verdicts')
    .delete()
    .eq('id', verdictId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export function inputFromVerdict(verdict: VerdictRow): PurchaseInput {
  const reasoning = verdict.reasoning as { importantPurchase?: boolean } | null
  return {
    title: verdict.candidate_title,
    price: verdict.candidate_price ?? null,
    category: verdict.candidate_category ?? null,
    vendor: verdict.candidate_vendor ?? null,
    justification: verdict.justification ?? null,
    isImportant: reasoning?.importantPurchase ?? false,
  }
}

export async function submitVerdict(
  userId: string,
  input: PurchaseInput,
  evaluation: EvaluationResult,
  existingVerdictId?: string
): Promise<{ data: VerdictRow | null; error: string | null }> {
  const vendorMatch = await retrieveVendorMatch(input)
  const holdReleaseAt =
    evaluation.outcome === 'hold'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null

  const verdictPayload = {
    candidate_vendor_id: vendorMatch?.vendor_id ?? null,
    scoring_model: 'llm_only' as const,
    predicted_outcome: evaluation.outcome,
    confidence_score: evaluation.confidence,
    reasoning: evaluation.reasoning,
    hold_release_at: holdReleaseAt,
  }

  if (existingVerdictId) {
    const { error } = await supabase
      .from('verdicts')
      .update(verdictPayload)
      .eq('id', existingVerdictId)
      .eq('user_id', userId)

    if (error) {
      return { data: null, error: error.message }
    }
  } else {
    const { error } = await supabase.from('verdicts').insert({
      user_id: userId,
      candidate_title: input.title,
      candidate_price: input.price,
      candidate_category: input.category,
      candidate_vendor: input.vendor,
      justification: input.justification,
      ...verdictPayload,
    })

    if (error) {
      return { data: null, error: error.message }
    }
  }

  const { data, error: fetchError } = await supabase
    .from('verdicts')
    .select(
      'id, candidate_title, candidate_price, candidate_category, candidate_vendor, scoring_model, justification, predicted_outcome, confidence_score, reasoning, created_at, hold_release_at, user_proceeded, actual_outcome, user_decision, user_hold_until'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchError) {
    return { data: null, error: fetchError.message }
  }

  return { data: data as VerdictRow, error: null }
}

const fetchUserProfile = async (userId: string) => {
  const { data: profile } = await supabase
    .from('users')
    .select('weekly_fun_budget, onboarding_answers')
    .eq('id', userId)
    .maybeSingle()

  return {
    weeklyBudget: (profile?.weekly_fun_budget as number | null) ?? null,
    onboardingAnswers: (profile?.onboarding_answers as OnboardingAnswers | null) ?? null,
  }
}

const gatherEvaluationContext = async (
  userId: string,
  input: PurchaseInput,
  weeklyBudget: number | null,
  onboardingAnswers: OnboardingAnswers | null,
  openaiApiKey?: string
): Promise<EvaluationContext> => {
  const vendorMatch = await retrieveVendorMatch(input)
  const psychScores = computePsychScores(onboardingAnswers)

  const financialStrainValue = computeFinancialStrain(input.price, weeklyBudget, input.isImportant)
  const financialStrain = buildScore(
    financialStrainValue,
    weeklyBudget
      ? `Relative to weekly fun budget of $${weeklyBudget.toFixed(2)}.`
      : 'No weekly fun budget set.'
  )

  const patternRepetition = await computePatternRepetition(userId, input.category ?? null)

  const [
    profileContext,
    recentRatedPurchases,
    similarRecentPurchases,
    longTermRatedPurchases,
    similarLongTermPurchases,
  ] = await Promise.all([
    retrieveUserProfileContext(userId),
    retrieveRecentPurchases(userId, 5, { ratingWindow: 'recent' }),
    retrieveSimilarPurchases(userId, input, 5, openaiApiKey, { ratingWindow: 'recent' }),
    retrieveRecentPurchases(userId, 5, { ratingWindow: 'long_term' }),
    retrieveSimilarPurchases(userId, input, 5, openaiApiKey, { ratingWindow: 'long_term' }),
  ])

  return {
    profileContext,
    recentRatedPurchases,
    similarRecentPurchases,
    longTermRatedPurchases,
    similarLongTermPurchases,
    vendorMatch,
    weeklyBudget,
    patternRepetition,
    financialStrain,
    psychScores,
  }
}

export async function evaluatePurchase(
  userId: string,
  input: PurchaseInput,
  openaiApiKey?: string
): Promise<EvaluationResult> {
  const { weeklyBudget, onboardingAnswers } = await fetchUserProfile(userId)

  const context = await gatherEvaluationContext(
    userId,
    input,
    weeklyBudget,
    onboardingAnswers,
    openaiApiKey
  )

  if (!openaiApiKey) {
    return evaluateWithFallback(input, context)
  }

  return evaluateWithLlm(openaiApiKey, input, context)
}

export type { VerdictOutcome }
