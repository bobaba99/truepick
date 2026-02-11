import { supabase } from './supabaseClient'
import type {
  EvaluationResult,
  LLMEvaluationResponse,
  OnboardingAnswers,
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
import { clamp01 } from './utils'

const SUPPORTED_VERDICTS: VerdictOutcome[] = ['buy', 'hold', 'skip']

const normalizeLikert = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return 0
  return clamp01((value - min) / (max - min))
}

const isVerdictOutcome = (value: unknown): value is VerdictOutcome => {
  return typeof value === 'string' && SUPPORTED_VERDICTS.includes(value as VerdictOutcome)
}

const getFallbackAlgorithm = (algorithm: VerdictAlgorithm): VerdictAlgorithm => {
  return algorithm === 'llm_only' ? 'standard' : algorithm
}

const OUTCOME_RATIONALE_LABEL: Record<VerdictOutcome, string> = {
  buy: 'buy now',
  hold: 'hold or delay',
  skip: 'skip',
}

const alignRationaleWithOutcome = (outcome: VerdictOutcome, rationale: string) => {
  const trimmedRationale = rationale.trim()
  const strippedRationale = trimmedRationale
    .replace(/^(?:\s*outcome\s*:\s*[^.]+\.?\s*)+/i, '')
    .replace(
      /^(?:\s*(?:outcome\s*\+\s*primary reason|primary reason|recommendation)\s*[:\-]\s*)+/i,
      ''
    )
    .replace(
      /\boutcome\s*:\s*(?:buy(?:\s+now)?|hold(?:\s+or\s+delay)?|skip|approve(?:\s+the\s+purchase)?)\.?\s*/gi,
      ''
    )
    .trim()
  const body = strippedRationale.length > 0 ? strippedRationale : trimmedRationale
  return `Outcome: ${OUTCOME_RATIONALE_LABEL[outcome]}. ${body}`.trim()
}

const hasAnyToken = (text: string, tokens: string[]) => {
  return tokens.some((token) => text.includes(token))
}

const hasPriceToleranceLanguage = (text: string) => {
  const tolerancePatterns = [
    /price.{0,24}(tolerable|acceptable|reasonable|justified)/,
    /(premium|luxury).{0,24}(acceptable|reasonable|justified|warranted)/,
    /(worth|justified).{0,24}(higher price|higher cost|premium)/,
    /not (a|the) dealbreaker/,
    /not (by itself|by themselves)/,
    /(despite|even with).{0,24}(high price|premium|luxury)/,
  ]
  return tolerancePatterns.some((pattern) => pattern.test(text))
}

const hasPromptTemplateLeak = (text: unknown) => {
  if (typeof text !== 'string') {
    return true
  }

  const normalized = text.toLowerCase()
  const leakMarkers = [
    '<write a personalized',
    'critical: do not just list facts',
    'structure:',
    'outcome + primary reason',
    'use a warm, conversational tone',
    'example: we',
    '<2-3 sentences offering an alternative',
  ]
  return leakMarkers.some((marker) => normalized.includes(marker))
}

const isEssentialImportantHighUtilityPurchase = (
  input: PurchaseInput,
  llmResponse: LLMEvaluationResponse,
  vendorPriceTier: 'budget' | 'mid_range' | 'premium' | 'luxury' | null
) => {
  if (!input.isImportant) {
    return false
  }

  const justification = (input.justification ?? '').toLowerCase()
  const hasEssentialSignal = hasAnyToken(justification, [
    'essential',
    'for work',
    'required',
    'need',
    'photo',
    'video',
    'editing',
    'machine learning',
    'ml',
  ])
  const hasStrongLongTermUtility =
    typeof llmResponse.long_term_utility?.score === 'number' &&
    llmResponse.long_term_utility.score >= 0.65
  const hasHighPriceOrPremiumTier =
    (typeof input.price === 'number' && input.price >= 200) ||
    vendorPriceTier === 'premium' ||
    vendorPriceTier === 'luxury'

  return hasEssentialSignal && hasStrongLongTermUtility && hasHighPriceOrPremiumTier
}

const validateImportantPurchaseLlmOnlyRationale = (
  input: PurchaseInput,
  llmResponse: LLMEvaluationResponse,
  vendorPriceTier: 'budget' | 'mid_range' | 'premium' | 'luxury' | null
): { isValid: boolean; reason?: string } => {
  if (!input.isImportant) {
    return { isValid: true }
  }

  const rationale =
    (typeof llmResponse.rationale === 'string' ? llmResponse.rationale : '')
      .toLowerCase()
      .trim()
  if (!rationale) {
    return { isValid: false, reason: 'Missing rationale for important purchase.' }
  }

  const mentionsImportantPurchase =
    /\bimportant purchase\b/.test(rationale) ||
    /\bis important\b/.test(rationale) ||
    /\bhigh[-\s]?priority\b/.test(rationale) ||
    /\bpriority purchase\b/.test(rationale)
  if (!mentionsImportantPurchase) {
    return {
      isValid: false,
      reason: 'Rationale must explicitly acknowledge this is an important purchase.',
    }
  }

  const mentionsPriceTolerance = hasPriceToleranceLanguage(rationale)
  if (!mentionsPriceTolerance) {
    return {
      isValid: false,
      reason:
        'Rationale must explicitly state that high price/premium tier is tolerated for important purchases.',
    }
  }

  const flagsHighPriceAsPrimaryNegative =
    /(primary|primarily|mainly|chief|key|main|biggest concern|primary concern|main reason).{0,40}(high price|expensive|premium|luxury|cost|overpriced|price point)/.test(rationale) ||
    /(high price|expensive|premium|luxury|cost|overpriced|price point).{0,40}(primary|primarily|mainly|chief|key|main|biggest concern|primary concern|main reason)/.test(rationale)
  if (!flagsHighPriceAsPrimaryNegative) {
    return { isValid: true }
  }

  const hasAffordabilityEvidence = hasAnyToken(rationale, [
    'financial strain',
    'over budget',
    'cannot afford',
    "can't afford",
    'affordability concern',
    'strain on affordability',
    'weekly fun budget',
  ])
  const hasLongTermUtilityEvidence = hasAnyToken(rationale, [
    'long-term utility',
    'long term utility',
    'low utility',
    'unlikely to use',
    "didn't get used",
    'poor durability',
  ])

  if (!hasAffordabilityEvidence && !hasLongTermUtilityEvidence) {
    return {
      isValid: false,
      reason:
        'Rationale treats high price/premium tier as the primary negative reason without affordability strain or low long-term utility evidence.',
    }
  }

  if (
    llmResponse.verdict === 'skip' &&
    isEssentialImportantHighUtilityPurchase(input, llmResponse, vendorPriceTier)
  ) {
    return {
      isValid: false,
      reason:
        "Important essential purchases with strong long-term utility and high price/premium tier must not return a 'skip' verdict.",
    }
  }

  return { isValid: true }
}

const computePsychScores = (answers?: OnboardingAnswers | null) => {
  if (!answers) {
    return { neuroticism: 0, materialism: 0, locusOfControl: 0 }
  }

  const neuroticism =
    typeof answers.neuroticismScore === 'number'
      ? normalizeLikert(answers.neuroticismScore, 1, 5)
      : 0

  const materialismValues = answers.materialism
    ? [
        answers.materialism.centrality,
        answers.materialism.happiness,
        answers.materialism.success,
      ]
    : []
  const materialismAverage =
    materialismValues.length > 0
      ? materialismValues.reduce((sum, value) => sum + value, 0) / materialismValues.length
      : null
  const materialism =
    materialismAverage !== null ? normalizeLikert(materialismAverage, 1, 4) : 0

  let locusOfControl = 0
  if (answers.locusOfControl) {
    const workHard = normalizeLikert(answers.locusOfControl.workHard, 1, 5)
    const destiny = normalizeLikert(answers.locusOfControl.destiny, 1, 5)
    locusOfControl = clamp01((workHard + (1 - destiny)) / 2)
  }

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

export async function regenerateVerdict(
  userId: string,
  verdict: VerdictRow,
  openaiApiKey?: string
): Promise<{ data: VerdictRow | null; error: string | null }> {
  if (!openaiApiKey) {
    return { data: null, error: 'Regenerate requires a configured OpenAI API key.' }
  }

  const reasoning = verdict.reasoning as { importantPurchase?: boolean } | null
  const input: PurchaseInput = {
    title: verdict.candidate_title,
    price: verdict.candidate_price ?? null,
    category: verdict.candidate_category ?? null,
    vendor: verdict.candidate_vendor ?? null,
    justification: verdict.justification ?? null,
    isImportant: reasoning?.importantPurchase ?? false,
  }

  const algorithm = verdict.scoring_model ?? 'standard'
  const evaluation = await evaluatePurchase(userId, input, openaiApiKey, algorithm, {
    isRegeneration: true,
  })
  const vendorMatch = await retrieveVendorMatch(input)
  const holdReleaseAt =
    evaluation.outcome === 'hold'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null

  const { error } = await supabase
    .from('verdicts')
    .update({
      candidate_vendor_id: vendorMatch?.vendor_id ?? null,
      scoring_model: algorithm,
      predicted_outcome: evaluation.outcome,
      confidence_score: evaluation.confidence,
      reasoning: evaluation.reasoning,
      hold_release_at: holdReleaseAt,
    })
    .eq('id', verdict.id)
    .eq('user_id', userId)

  if (error) {
    return { data: null, error: error.message }
  }

  const { data, error: fetchError } = await supabase
    .from('verdicts')
    .select(
      'id, candidate_title, candidate_price, candidate_category, candidate_vendor, scoring_model, justification, predicted_outcome, confidence_score, reasoning, created_at, hold_release_at, user_proceeded, actual_outcome, user_decision, user_hold_until'
    )
    .eq('id', verdict.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchError) {
    return { data: null, error: fetchError.message }
  }

  return { data: data as VerdictRow, error: null }
}

export async function evaluatePurchase(
  userId: string,
  input: PurchaseInput,
  openaiApiKey?: string,
  algorithm: VerdictAlgorithm = 'standard',
  regeneration?: {
    isRegeneration: boolean
  }
): Promise<EvaluationResult> {
  const vendorMatch = await retrieveVendorMatch(input)
  const { data: profile } = await supabase
    .from('users')
    .select('weekly_fun_budget, onboarding_answers')
    .eq('id', userId)
    .maybeSingle()

  const psychScores = computePsychScores(
    (profile?.onboarding_answers as OnboardingAnswers | null | undefined) ?? null
  )

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

  if (!openaiApiKey) {
    console.warn('No OpenAI API key provided, using fallback evaluation')
    return evaluatePurchaseFallback(input, {
      patternRepetition,
      financialStrain,
      vendorMatch,
      profileContextSummary: profileContext,
      similarPurchasesSummary: `${similarRecentPurchases}\n${similarLongTermPurchases}`,
      recentPurchasesSummary: `${recentRatedPurchases}\n${longTermRatedPurchases}`,
      psychScores,
      algorithm: getFallbackAlgorithm(algorithm),
    })
  }

  try {
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(
      input,
      profileContext,
      similarRecentPurchases,
      recentRatedPurchases,
      similarLongTermPurchases,
      longTermRatedPurchases,
      vendorMatch,
      algorithm
    )
    const maxAttempts =
      regeneration?.isRegeneration || (algorithm === 'llm_only' && input.isImportant) ? 2 : 1
    let retryReason = ''
    let llmResponse: LLMEvaluationResponse | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const importantPurchaseRetryInstruction =
        algorithm === 'llm_only' && input.isImportant
          ? `\nFor important purchases and essential items, high price/premium tier is tolerated unless there is poor long-term utility evidence.
          If it is a high price/premium tier purchase with long-term utility and essential, approve the purchase regardless of value conflicts and high upfront cost,
          add a suggestion for financing options, but never return a 'skip' verdict.`
          : ''

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
            {
              role: 'user',
              content: `${userPrompt}${importantPurchaseRetryInstruction}`,
            },
          ],
          max_completion_tokens: 4000,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`)
      }

      const data = await response.json()
      const message = data.choices?.[0]?.message
      const content = message?.content
      const finishReason = data.choices?.[0]?.finish_reason

      if (typeof content !== 'string' || content.trim().length === 0) {
        retryReason =
          finishReason === 'length'
            ? 'Model hit token limit before returning content.'
            : 'No content in LLM response.'
        if (attempt < maxAttempts) {
          continue
        }
        throw new Error(retryReason)
      }

      let candidateResponse: LLMEvaluationResponse
      try {
        candidateResponse = JSON.parse(content.trim()) as LLMEvaluationResponse
      } catch {
        retryReason = 'Response was not valid JSON.'
        if (attempt < maxAttempts) {
          continue
        }
        throw new Error('Invalid JSON in LLM response')
      }

      const leakedRationale = hasPromptTemplateLeak(candidateResponse.rationale)
      const leakedAlternative = hasPromptTemplateLeak(candidateResponse.alternative_solution)
      if (leakedRationale || leakedAlternative) {
        retryReason = 'Response included leaked prompt template text.'
        if (attempt < maxAttempts) {
          continue
        }
        throw new Error('LLM response contained prompt template text.')
      }

      if (algorithm === 'llm_only' && input.isImportant) {
        const validation = validateImportantPurchaseLlmOnlyRationale(
          input,
          candidateResponse,
          vendorMatch?.vendor_price_tier ?? null
        )
        if (!validation.isValid) {
          retryReason = validation.reason ?? 'Policy validation failed.'
          if (attempt < maxAttempts) {
            continue
          }
          throw new Error(`LLM-only policy violation: ${retryReason}`)
        }
      }

      llmResponse = candidateResponse
      break
    }

    if (!llmResponse) {
      throw new Error('No valid LLM response after policy validation.')
    }

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
    const shortTermRegret = buildScore(
      llmResponse.short_term_regret.score,
      llmResponse.short_term_regret.explanation
    )
    const longTermRegret = buildScore(
      llmResponse.long_term_regret.score,
      llmResponse.long_term_regret.explanation
    )

    if (
      !isVerdictOutcome(llmResponse.verdict) ||
      typeof llmResponse.confidence !== 'number' ||
      !Number.isFinite(llmResponse.confidence)
    ) {
      return evaluatePurchaseFallback(input, {
        patternRepetition,
        financialStrain,
        vendorMatch,
        profileContextSummary: profileContext,
        similarPurchasesSummary: `${similarRecentPurchases}\n${similarLongTermPurchases}`,
        recentPurchasesSummary: `${recentRatedPurchases}\n${longTermRatedPurchases}`,
        psychScores,
        algorithm: getFallbackAlgorithm(algorithm),
      })
    }

    if (algorithm === 'llm_only') {
      const shouldForceApprove =
        llmResponse.verdict === 'skip' &&
        isEssentialImportantHighUtilityPurchase(
          input,
          llmResponse,
          vendorMatch?.vendor_price_tier ?? null
        )
      const llmOnlyVerdict: VerdictOutcome = shouldForceApprove ? 'buy' : llmResponse.verdict
      const llmOnlyConfidence = shouldForceApprove
        ? clamp01(Math.max(llmResponse.confidence, 0.65))
        : clamp01(llmResponse.confidence)
      const llmOnlyRationale = shouldForceApprove
        ? `${llmResponse.rationale} This is treated as an essential important purchase with strong long-term utility, so never return a skip outcome. Add a suggestion for financing options.`
        : llmResponse.rationale

      return {
        outcome: llmOnlyVerdict,
        confidence: llmOnlyConfidence,
        reasoning: {
          valueConflict,
          patternRepetition,
          emotionalImpulse,
          financialStrain,
          longTermUtility,
          emotionalSupport,
          shortTermRegret,
          longTermRegret,
          alternativeSolution: llmResponse.alternative_solution,
          rationale: alignRationaleWithOutcome(llmOnlyVerdict, llmOnlyRationale),
          importantPurchase: input.isImportant,
          algorithm,
        },
      }
    }

    const decisionResult = computeDecisionByAlgorithm(algorithm, {
      valueConflict: valueConflict.score,
      patternRepetition: patternRepetition.score,
      emotionalImpulse: emotionalImpulse.score,
      financialStrain: financialStrain.score,
      longTermUtility: longTermUtility.score,
      emotionalSupport: emotionalSupport.score,
      neuroticism: psychScores.neuroticism,
      materialism: psychScores.materialism,
      locusOfControl: psychScores.locusOfControl,
    })
    const finalOutcome = llmResponse.verdict
    const finalConfidence = clamp01(llmResponse.confidence)

    return {
      outcome: finalOutcome,
      confidence: finalConfidence,
      reasoning: {
        valueConflict,
        patternRepetition,
        emotionalImpulse,
        financialStrain,
        longTermUtility,
        emotionalSupport,
        shortTermRegret,
        longTermRegret,
        alternativeSolution: llmResponse.alternative_solution,
        decisionScore: decisionResult.decisionScore,
        rationale: alignRationaleWithOutcome(finalOutcome, llmResponse.rationale),
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
      similarPurchasesSummary: `${similarRecentPurchases}\n${similarLongTermPurchases}`,
      recentPurchasesSummary: `${recentRatedPurchases}\n${longTermRatedPurchases}`,
      psychScores,
      algorithm: getFallbackAlgorithm(algorithm),
    })
  }
}

export type { VerdictOutcome }
