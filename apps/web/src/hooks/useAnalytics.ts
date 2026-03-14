/**
 * Google Analytics 4 telemetry module
 *
 * Three event tiers:
 *   Tier 1 — Core actions (what users do)
 *   Tier 2 — Friction & latency signals (where users get stuck)
 *   Tier 3 — Micro-interactions (engagement depth)
 *
 * All methods are no-ops when VITE_GA4_MEASUREMENT_ID is unset.
 * No PII is ever sent — user ID is the opaque Supabase UUID.
 */

import ReactGA from 'react-ga4'
import posthog from 'posthog-js'

const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID ?? ''
const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY ?? ''
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

export const isAnalyticsEnabled = (): boolean => GA4_ID.length > 0
export const isPostHogEnabled = (): boolean => POSTHOG_KEY.length > 0

export const initializeGA4 = (): void => {
  if (!isAnalyticsEnabled()) return
  ReactGA.initialize(GA4_ID)
}

export const initializePostHog = (): void => {
  if (!isPostHogEnabled()) return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask]',
      sampleRate: 1, // 100% at MVP — reduce to 0.2 at 10k+ DAU
    },
  })
}

export const setAnalyticsUserId = (userId: string | null): void => {
  if (!isAnalyticsEnabled()) return
  ReactGA.set({ user_id: userId ?? undefined })
}

export const identifyPostHogUser = (userId: string | null, isAnonymous = false): void => {
  if (!isPostHogEnabled()) return
  if (userId) {
    posthog.identify(userId, { is_anonymous: isAnonymous })
  } else {
    posthog.reset()
  }
}

const trackEvent = (
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
): void => {
  if (isAnalyticsEnabled()) {
    ReactGA.event(eventName, params)
  }
  if (isPostHogEnabled()) {
    posthog.capture(eventName, params)
  }
}

type AuthMethod = 'email' | 'google' | 'apple'
type InputMethod = 'manual' | 'chrome_extension' | 'url_paste'
type UserTier = 'free' | 'premium'

export const bucketPrice = (price: number | null): string => {
  if (price === null || price === undefined) return 'unknown'
  if (price < 25) return '0-25'
  if (price < 100) return '25-100'
  if (price < 500) return '100-500'
  return '500+'
}

// ---------------------------------------------------------------------------
// Tier 1: Core Actions
// ---------------------------------------------------------------------------

const trackSignUp = (method: AuthMethod = 'email') => trackEvent('sign_up', { method })

const trackLogin = (method: AuthMethod = 'email') => trackEvent('login', { method })

const trackSignOut = () => trackEvent('sign_out')

const trackGuestContinued = () => trackEvent('guest_continued')

const trackVerdictSubmitted = (params: {
  verdictValue: string
  category: string
  price: number | null
  decisionTimeSeconds: number
}) =>
  trackEvent('verdict_submitted', {
    verdict_value: params.verdictValue,
    category: params.category,
    price_range: bucketPrice(params.price),
    decision_time_seconds: params.decisionTimeSeconds,
  })

const trackVerdictDecision = (decision: string, verdictAgeSeconds: number) =>
  trackEvent('verdict_decision', {
    decision,
    verdict_age_seconds: verdictAgeSeconds,
  })

const trackVerdictRegenerated = () => trackEvent('verdict_regenerated')

const trackVerdictShared = (shareMethod: string) =>
  trackEvent('verdict_shared', { share_method: shareMethod })

const trackEmailImportCompleted = (
  provider: string,
  receiptsCount: number,
  skippedCount: number,
  errorCount: number,
) =>
  trackEvent('email_import_completed', {
    provider,
    receipts_count: receiptsCount,
    skipped_count: skippedCount,
    error_count: errorCount,
  })

const trackSwipeCompleted = (params: {
  direction: string
  outcome: string
  purchaseAgeDays: number
}) =>
  trackEvent('swipe_completed', {
    direction: params.direction,
    outcome: params.outcome,
    purchase_age_days: params.purchaseAgeDays,
  })

const trackSwipeUndone = (originalOutcome: string) =>
  trackEvent('swipe_undone', { original_outcome: originalOutcome })

const trackPurchaseAdded = (source: string) =>
  trackEvent('purchase_added', { source })

const trackPurchaseDeleted = () => trackEvent('purchase_deleted')

const trackProfileUpdated = (hasBudget: boolean, quizSectionsFilled: number) =>
  trackEvent('profile_updated', {
    has_budget: hasBudget,
    quiz_sections_filled: quizSectionsFilled,
  })

const trackSettingsChanged = (settingName: string, newValue: string) =>
  trackEvent('settings_changed', { setting_name: settingName, new_value: newValue })

const trackOnboardingStarted = () => trackEvent('onboarding_started')

const trackOnboardingCompleted = (totalSteps: number) =>
  trackEvent('onboarding_completed', { total_steps: totalSteps })

// ---------------------------------------------------------------------------
// Tier 1+: Paywall & Conversion Events
// ---------------------------------------------------------------------------

const trackVerdictRequested = (params: {
  product_category: string
  price_range: string
  input_method: InputMethod
  user_tier: UserTier
  verdicts_remaining_today: number | null
}) =>
  trackEvent('verdict_requested', {
    product_category: params.product_category,
    price_range: params.price_range,
    input_method: params.input_method,
    user_tier: params.user_tier,
    verdicts_remaining_today: params.verdicts_remaining_today ?? undefined,
  })

const trackVerdictDelivered = (params: {
  verdict_outcome: string
  confidence_score: number | null
  response_latency_ms: number
  verdict_id: string
}) =>
  trackEvent('verdict_delivered', {
    verdict_outcome: params.verdict_outcome,
    confidence_score: params.confidence_score ?? undefined,
    response_latency_ms: Math.round(params.response_latency_ms),
    verdict_id: params.verdict_id,
  })

const trackVerdictOverride = (params: {
  verdict_id: string
  original_verdict: string
  user_action: 'bought_anyway' | 'skipped_anyway'
  time_since_verdict_ms: number
}) =>
  trackEvent('verdict_override', {
    verdict_id: params.verdict_id,
    original_verdict: params.original_verdict,
    user_action: params.user_action,
    time_since_verdict_ms: Math.round(params.time_since_verdict_ms),
  })

const trackPaywallHit = (params: {
  verdicts_used_today: number
  session_verdicts_count: number
  time_of_day: number
  day_of_week: number
}) =>
  trackEvent('paywall_hit', {
    verdicts_used_today: params.verdicts_used_today,
    session_verdicts_count: params.session_verdicts_count,
    time_of_day: params.time_of_day,
    day_of_week: params.day_of_week,
  })

const trackPaywallConversionStarted = (params: {
  trigger_context: string
  verdicts_at_conversion: number | null
}) =>
  trackEvent('paywall_conversion_started', {
    trigger_context: params.trigger_context,
    verdicts_at_conversion: params.verdicts_at_conversion ?? undefined,
  })

const trackShareCardGenerated = (params: {
  verdict_id: string
  share_destination: string | null
  theme_selected: string
}) =>
  trackEvent('share_card_generated', {
    verdict_id: params.verdict_id,
    share_destination: params.share_destination ?? undefined,
    theme_selected: params.theme_selected,
  })

// ---------------------------------------------------------------------------
// Tier 2: Friction & Latency Signals
// ---------------------------------------------------------------------------

const trackVerdictEvalStarted = () => trackEvent('verdict_eval_started')

const trackVerdictEvalDuration = (durationMs: number, isFallback: boolean) =>
  trackEvent('verdict_eval_duration', {
    duration_ms: Math.round(durationMs),
    is_fallback: isFallback,
  })

const trackVerdictEvalError = (errorType: string) =>
  trackEvent('verdict_eval_error', { error_type: errorType })

const trackEmailImportStarted = (provider: string) =>
  trackEvent('email_import_started', { provider })

const trackEmailImportDuration = (durationMs: number, provider: string) =>
  trackEvent('email_import_duration', {
    duration_ms: Math.round(durationMs),
    provider,
  })

const trackEmailImportError = (provider: string, errorType: string) =>
  trackEvent('email_import_error', { provider, error_type: errorType })

const trackEmailOauthStarted = (provider: string) =>
  trackEvent('email_oauth_started', { provider })

const trackEmailOauthCompleted = (provider: string) =>
  trackEvent('email_oauth_completed', { provider })

const trackEmailOauthError = (provider: string, errorType: string) =>
  trackEvent('email_oauth_error', { provider, error_type: errorType })

const trackEmailTokenRefresh = (provider: string, success: boolean) =>
  trackEvent('email_token_refresh', { provider, success })

const trackShareImageRenderDuration = (durationMs: number) =>
  trackEvent('share_image_render_duration', { duration_ms: Math.round(durationMs) })

const trackShareLinkCreated = (durationMs: number) =>
  trackEvent('share_link_created', { duration_ms: Math.round(durationMs) })

const trackSessionLoadDuration = (durationMs: number) =>
  trackEvent('session_load_duration', { duration_ms: Math.round(durationMs) })

const trackVerdictRegenDuration = (durationMs: number) =>
  trackEvent('verdict_regen_duration', { duration_ms: Math.round(durationMs) })

const trackFormValidationError = (field: string, errorType: string) =>
  trackEvent('form_validation_error', { field, error_type: errorType })

const trackSwipeLoadDuration = (durationMs: number, count: number) =>
  trackEvent('swipe_load_duration', { duration_ms: Math.round(durationMs), count })

const trackOnboardingDismissed = (stepDismissedAt: number) =>
  trackEvent('onboarding_dismissed', { step_dismissed_at: stepDismissedAt })

// ---------------------------------------------------------------------------
// Tier 3: Micro-Interactions
// ---------------------------------------------------------------------------

const trackFormFieldFocused = (fieldName: string) =>
  trackEvent('form_field_focused', { field_name: fieldName })

const trackFormAbandoned = (fieldsFilled: number, timeSpentSeconds: number) =>
  trackEvent('form_abandoned', {
    fields_filled: fieldsFilled,
    time_spent_seconds: Math.round(timeSpentSeconds),
  })

const trackVerdictDetailOpened = (verdictValue: string) =>
  trackEvent('verdict_detail_opened', { verdict_value: verdictValue })

const trackVerdictRationaleExpanded = () => trackEvent('verdict_rationale_expanded')

const trackVerdictFeedback = (feedback: 'up' | 'down' | 'removed', verdictOutcome: string) =>
  trackEvent('verdict_feedback', { feedback, verdict_outcome: verdictOutcome })

const trackFilterApplied = (page: string, filterType: string) =>
  trackEvent('filter_applied', { page, filter_type: filterType })

const trackProfileModalOpened = () => trackEvent('profile_modal_opened')

const trackProfileModalAbandoned = (timeSpentSeconds: number, sectionsChanged: number) =>
  trackEvent('profile_modal_abandoned', {
    time_spent_seconds: Math.round(timeSpentSeconds),
    sections_changed: sectionsChanged,
  })

const trackProfileTabSwitched = (tabName: string) =>
  trackEvent('profile_tab_switched', { tab_name: tabName })

const trackEmailImportModalOpened = () => trackEvent('email_import_modal_opened')

const trackEmptyStateShown = (page: string, stateType: string) =>
  trackEvent('empty_state_shown', { page, state_type: stateType })

const trackNavMenuOpened = () => trackEvent('nav_menu_opened')

const trackSharedVerdictViewed = () => trackEvent('shared_verdict_viewed')

const trackSharedVerdictCtaClicked = () => trackEvent('shared_verdict_cta_clicked')

const trackOnboardingStepViewed = (stepIndex: number, stepId: string) =>
  trackEvent('onboarding_step_viewed', { step_index: stepIndex, step_id: stepId })

const trackOnboardingCtaClicked = (stepId: string, ctaRoute: string) =>
  trackEvent('onboarding_cta_clicked', { step_id: stepId, cta_route: ctaRoute })

const trackWaitlistSubmitted = (source: string) =>
  trackEvent('waitlist_submitted', { source })

const trackLandingCtaClicked = (ctaId: string) =>
  trackEvent('landing_cta_clicked', { cta_id: ctaId })

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const analytics = {
  // Tier 1
  trackSignUp,
  trackVerdictRequested,
  trackVerdictDelivered,
  trackVerdictOverride,
  trackPaywallHit,
  trackPaywallConversionStarted,
  trackShareCardGenerated,
  trackLogin,
  trackSignOut,
  trackGuestContinued,
  trackVerdictSubmitted,
  trackVerdictDecision,
  trackVerdictRegenerated,
  trackVerdictShared,
  trackEmailImportCompleted,
  trackSwipeCompleted,
  trackSwipeUndone,
  trackPurchaseAdded,
  trackPurchaseDeleted,
  trackProfileUpdated,
  trackSettingsChanged,
  trackOnboardingStarted,
  trackOnboardingCompleted,

  // Tier 2
  trackVerdictEvalStarted,
  trackVerdictEvalDuration,
  trackVerdictEvalError,
  trackEmailImportStarted,
  trackEmailImportDuration,
  trackEmailImportError,
  trackEmailOauthStarted,
  trackEmailOauthCompleted,
  trackEmailOauthError,
  trackEmailTokenRefresh,
  trackShareImageRenderDuration,
  trackShareLinkCreated,
  trackSessionLoadDuration,
  trackVerdictRegenDuration,
  trackFormValidationError,
  trackSwipeLoadDuration,
  trackOnboardingDismissed,

  // Tier 3
  trackFormFieldFocused,
  trackFormAbandoned,
  trackVerdictDetailOpened,
  trackVerdictRationaleExpanded,
  trackVerdictFeedback,
  trackFilterApplied,
  trackProfileModalOpened,
  trackProfileModalAbandoned,
  trackProfileTabSwitched,
  trackEmailImportModalOpened,
  trackEmptyStateShown,
  trackNavMenuOpened,
  trackSharedVerdictViewed,
  trackSharedVerdictCtaClicked,
  trackOnboardingStepViewed,
  trackOnboardingCtaClicked,
  trackWaitlistSubmitted,
  trackLandingCtaClicked,
}

export { analytics }
