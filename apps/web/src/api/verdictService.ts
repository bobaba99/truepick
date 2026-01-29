import { supabase } from './supabaseClient'
import type {
  EvaluationResult,
  LLMEvaluationResponse,
  PurchaseInput,
  UserDecision,
  VerdictAlgorithm,
  VerdictOutcome,
  VerdictRow,
} from './types'
import {
  computePatternRepetition,
  retrieveRecentPurchases,
  retrieveSimilarPurchases,
  retrieveUserProfileContext,
  retrieveVendorMatch,
} from './verdictContext'
import { buildSystemPrompt, buildUserPrompt } from './verdictPrompts'
import {
  buildScore,
  computeFinancialStrain,
  computeDecisionByAlgorithm,
  evaluatePurchaseFallback,
} from './verdictScoring'

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

  if (error || !data) {
    return null
  }

  return data as VerdictRow
}

export async function getVerdictHistory(
  userId: string,
  limit = 10
): Promise<VerdictRow[]> {
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
): Promise<{ error: string | null }> {
  const userHoldUntil =
    decision === 'hold'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null

  const { data: verdict, error: fetchError } = await supabase
    .from('verdicts')
    .select(
      'candidate_title, candidate_price, candidate_category, candidate_vendor, user_decision, user_hold_until',
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
    const holdUntil =
      verdict.user_hold_until ? new Date(verdict.user_hold_until) : null
    const effectivePurchaseDate =
      holdUntil && holdUntil <= now ? holdUntil : now

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
      return { error: purchaseError.message }
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

  return { error: error?.message ?? null }
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

export async function createVerdict(
  userId: string,
  input: PurchaseInput,
  evaluation: EvaluationResult
): Promise<{ error: string | null }> {
  const vendorMatch = await retrieveVendorMatch(input)
  const scoringModel = evaluation.reasoning?.algorithm ?? 'standard'
  const holdReleaseAt =
    evaluation.outcome === 'hold'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null

  const { error } = await supabase.from('verdicts').insert({
    user_id: userId,
    candidate_title: input.title,
    candidate_price: input.price,
    candidate_category: input.category,
    candidate_vendor: input.vendor,
    candidate_vendor_id: vendorMatch?.vendor_id ?? null,
    scoring_model: scoringModel,
    justification: input.justification,
    predicted_outcome: evaluation.outcome,
    confidence_score: evaluation.confidence,
    reasoning: evaluation.reasoning,
    hold_release_at: holdReleaseAt,
  })

  return { error: error?.message ?? null }
}

export async function evaluatePurchase(
  userId: string,
  input: PurchaseInput,
  openaiApiKey?: string,
  algorithm: VerdictAlgorithm = 'standard'
): Promise<EvaluationResult> {
  const vendorMatch = await retrieveVendorMatch(input)
  const { data: profile } = await supabase
    .from('users')
    .select('weekly_fun_budget')
    .eq('id', userId)
    .maybeSingle()

  const financialStrainValue = computeFinancialStrain(
    input.price,
    profile?.weekly_fun_budget ?? null,
    input.isImportant
  )
  const financialStrain = buildScore(
    financialStrainValue,
    profile?.weekly_fun_budget
      ? `Relative to weekly fun budget of $${profile.weekly_fun_budget.toFixed(2)}.`
      : 'No weekly fun budget set.'
  )

  const patternRepetition = await computePatternRepetition(userId, input.category ?? null)
  const [profileContext, similarPurchases, recentPurchases] = await Promise.all([
    retrieveUserProfileContext(userId),
    retrieveSimilarPurchases(userId, input, 5, openaiApiKey),
    retrieveRecentPurchases(userId, 5),
  ])

  if (!openaiApiKey) {
    console.warn('No OpenAI API key provided, using fallback evaluation')
    return evaluatePurchaseFallback(input, {
      patternRepetition,
      financialStrain,
      vendorMatch,
      profileContextSummary: profileContext,
      similarPurchasesSummary: similarPurchases,
      recentPurchasesSummary: recentPurchases,
      algorithm,
    })
  }

  try {
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(
      input,
      profileContext,
      similarPurchases,
      recentPurchases,
      vendorMatch
    )

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content in LLM response')
    }

    const llmResponse = JSON.parse(content) as LLMEvaluationResponse

    const valueConflict = buildScore(
      llmResponse.value_conflict.score,
      llmResponse.value_conflict.explanation
    )
    const emotionalImpulse = buildScore(
      llmResponse.emotional_impulse.score,
      llmResponse.emotional_impulse.explanation
    )
    const longTermUtility = buildScore(
      llmResponse.long_term_utility.score,
      llmResponse.long_term_utility.explanation
    )
    const emotionalSupport = buildScore(
      llmResponse.emotional_support.score,
      llmResponse.emotional_support.explanation
    )

    const decisionResult = computeDecisionByAlgorithm(algorithm, {
      valueConflict: valueConflict.score,
      patternRepetition: patternRepetition.score,
      emotionalImpulse: emotionalImpulse.score,
      financialStrain: financialStrain.score,
      longTermUtility: longTermUtility.score,
      emotionalSupport: emotionalSupport.score,
    })

    return {
      outcome: decisionResult.outcome,
      confidence: decisionResult.confidence,
      reasoning: {
        valueConflict,
        patternRepetition,
        emotionalImpulse,
        financialStrain,
        longTermUtility,
        emotionalSupport,
        decisionScore: decisionResult.decisionScore,
        rationale: llmResponse.rationale,
        importantPurchase: input.isImportant,
        algorithm,
      },
    }
  } catch (error) {
    console.error('LLM evaluation failed, using fallback:', error)
    return evaluatePurchaseFallback(input, {
      patternRepetition,
      financialStrain,
      vendorMatch,
      profileContextSummary: profileContext,
      similarPurchasesSummary: similarPurchases,
      recentPurchasesSummary: recentPurchases,
      algorithm,
    })
  }
}

export type { VerdictOutcome }
