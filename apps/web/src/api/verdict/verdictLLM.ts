import { logger } from '../core/logger'
import type {
  EvaluationResult,
  LLMEvaluationResponse,
  PurchaseInput,
  VerdictOutcome,
} from '../core/types'
import { clamp01 } from '../core/utils'
import {
  hasPromptTemplateLeak,
  isEssentialImportantHighUtilityPurchase,
  validateImportantPurchaseRationale,
  type VendorPriceTier,
} from './verdictValidation'
import { buildSystemPrompt, buildUserPrompt } from './verdictPrompts'
import { buildScore, evaluatePurchaseFallback } from './verdictScoring'
import type { VendorMatch } from '../core/types'

const SUPPORTED_VERDICTS = ['buy', 'hold', 'skip'] as const

const OUTCOME_RATIONALE_LABEL: Record<VerdictOutcome, string> = {
  buy: 'buy now',
  hold: 'hold or delay',
  skip: 'skip',
}

const isVerdictOutcome = (value: unknown): value is VerdictOutcome =>
  typeof value === 'string' && SUPPORTED_VERDICTS.includes(value as VerdictOutcome)

const alignRationaleWithOutcome = (outcome: VerdictOutcome, rationale: string): string => {
  const trimmedRationale = rationale.trim()
  const strippedRationale = trimmedRationale
    .replace(/^(?:\s*outcome\s*:\s*[^.]+\.?\s*)+/i, '')
    .replace(
      /^(?:\s*(?:outcome\s*\+\s*primary reason|primary reason|recommendation)\s*[:-]\s*)+/i,
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

interface OpenAIResponse {
  choices?: Array<{
    message?: { content?: string }
    finish_reason?: string
  }>
}

type LlmAttemptResult =
  | { success: true; response: LLMEvaluationResponse }
  | { success: false; retryReason: string }

const attemptLlmCall = async (
  openaiApiKey: string,
  systemPrompt: string,
  userPrompt: string,
  retryContext: string
): Promise<{ data: OpenAIResponse | null; error: string | null }> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${userPrompt}${retryContext}` },
      ],
      max_completion_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    return { data: null, error: `OpenAI API error: ${response.status} - ${errorBody}` }
  }

  const data = (await response.json()) as OpenAIResponse
  return { data, error: null }
}

const parseLlmResponse = (
  data: OpenAIResponse,
  input: PurchaseInput,
  vendorPriceTier: VendorPriceTier,
  weeklyBudget: number | null
): LlmAttemptResult => {
  const content = data.choices?.[0]?.message?.content
  const finishReason = data.choices?.[0]?.finish_reason

  if (typeof content !== 'string' || content.trim().length === 0) {
    const reason =
      finishReason === 'length'
        ? 'Model hit token limit before returning content.'
        : 'No content in LLM response.'
    return { success: false, retryReason: reason }
  }

  let candidateResponse: LLMEvaluationResponse
  try {
    candidateResponse = JSON.parse(content.trim()) as LLMEvaluationResponse
  } catch {
    return { success: false, retryReason: 'Response was not valid JSON.' }
  }

  if (
    hasPromptTemplateLeak(candidateResponse.rationale) ||
    hasPromptTemplateLeak(candidateResponse.alternative_solution)
  ) {
    return { success: false, retryReason: 'Response included leaked prompt template text.' }
  }

  if (input.isImportant) {
    const validation = validateImportantPurchaseRationale(
      input,
      candidateResponse,
      vendorPriceTier,
      weeklyBudget
    )
    if (!validation.isValid) {
      return { success: false, retryReason: validation.reason ?? 'Policy validation failed.' }
    }
  }

  return { success: true, response: candidateResponse }
}

const executeLlmWithRetry = async (
  openaiApiKey: string,
  systemPrompt: string,
  userPrompt: string,
  input: PurchaseInput,
  vendorPriceTier: VendorPriceTier,
  weeklyBudget: number | null,
  maxAttempts = 2
): Promise<LLMEvaluationResponse> => {
  const attempts: string[] = []

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const retryContext =
      attempts.length > 0
        ? `\nYour previous response was rejected: ${attempts[attempts.length - 1]} Please fix this issue in your next response.`
        : ''

    const { data, error } = await attemptLlmCall(
      openaiApiKey,
      systemPrompt,
      userPrompt,
      retryContext
    )

    if (error) {
      throw new Error(error)
    }

    if (!data) {
      throw new Error('No response data from OpenAI')
    }

    const result = parseLlmResponse(data, input, vendorPriceTier, weeklyBudget)

    if (result.success) {
      return result.response
    }

    attempts.push(result.retryReason)

    if (attempt === maxAttempts) {
      throw new Error(result.retryReason)
    }
  }

  throw new Error('No valid LLM response after policy validation.')
}

export interface EvaluationContext {
  profileContext: string
  recentRatedPurchases: string
  similarRecentPurchases: string
  longTermRatedPurchases: string
  similarLongTermPurchases: string
  vendorMatch: VendorMatch | null
  weeklyBudget: number | null
  patternRepetition: { score: number; explanation: string }
  financialStrain: { score: number; explanation: string }
  psychScores: { neuroticism: number; materialism: number; locusOfControl: number }
}

const buildFallbackOverrides = (context: EvaluationContext) => ({
  patternRepetition: context.patternRepetition,
  financialStrain: context.financialStrain,
  vendorMatch: context.vendorMatch,
  profileContextSummary: context.profileContext,
  similarPurchasesSummary: `${context.similarRecentPurchases}\n${context.similarLongTermPurchases}`,
  recentPurchasesSummary: `${context.recentRatedPurchases}\n${context.longTermRatedPurchases}`,
  psychScores: context.psychScores,
  weeklyBudget: context.weeklyBudget,
})

const processLlmResponse = (
  llmResponse: LLMEvaluationResponse,
  input: PurchaseInput,
  context: EvaluationContext
): EvaluationResult => {
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
    return evaluatePurchaseFallback(input, buildFallbackOverrides(context))
  }

  const vendorPriceTier = context.vendorMatch?.vendor_price_tier ?? null
  const shouldForceApprove =
    llmResponse.verdict === 'skip' &&
    isEssentialImportantHighUtilityPurchase(
      input,
      llmResponse,
      vendorPriceTier,
      context.weeklyBudget
    )

  const overriddenVerdict: VerdictOutcome = shouldForceApprove ? 'buy' : llmResponse.verdict
  const overriddenConfidence = shouldForceApprove
    ? clamp01(Math.max(llmResponse.confidence, 0.65))
    : clamp01(llmResponse.confidence)
  const overriddenRationale = shouldForceApprove
    ? `${llmResponse.rationale} This is treated as an essential important purchase with strong long-term utility, so never return a skip outcome. Add a suggestion for financing options.`
    : llmResponse.rationale

  return {
    outcome: overriddenVerdict,
    confidence: overriddenConfidence,
    reasoning: {
      valueConflict,
      patternRepetition: context.patternRepetition,
      emotionalImpulse,
      financialStrain: context.financialStrain,
      longTermUtility,
      emotionalSupport,
      shortTermRegret,
      longTermRegret,
      alternativeSolution: llmResponse.alternative_solution,
      rationale: alignRationaleWithOutcome(overriddenVerdict, overriddenRationale),
      importantPurchase: input.isImportant,
      algorithm: 'llm_only',
    },
  }
}

export const evaluateWithLlm = async (
  openaiApiKey: string,
  input: PurchaseInput,
  context: EvaluationContext
): Promise<EvaluationResult> => {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(
    input,
    context.profileContext,
    context.similarRecentPurchases,
    context.recentRatedPurchases,
    context.similarLongTermPurchases,
    context.longTermRatedPurchases,
    context.vendorMatch,
    context.weeklyBudget
  )

  try {
    const llmResponse = await executeLlmWithRetry(
      openaiApiKey,
      systemPrompt,
      userPrompt,
      input,
      context.vendorMatch?.vendor_price_tier ?? null,
      context.weeklyBudget
    )

    return processLlmResponse(llmResponse, input, context)
  } catch (error) {
    logger.error('LLM evaluation failed, using fallback', {
      error: error instanceof Error ? error.message : String(error),
    })
    return evaluatePurchaseFallback(input, buildFallbackOverrides(context))
  }
}

export const evaluateWithFallback = (
  input: PurchaseInput,
  context: EvaluationContext
): EvaluationResult => {
  logger.warn('No OpenAI API key provided, using fallback evaluation')
  return evaluatePurchaseFallback(input, buildFallbackOverrides(context))
}
