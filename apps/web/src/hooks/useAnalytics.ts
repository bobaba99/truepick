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
    },
  })
}

export const setAnalyticsUserId = (userId: string | null): void => {
  if (!isAnalyticsEnabled()) return
  ReactGA.set({ user_id: userId ?? undefined })
}

export const identifyPostHogUser = (userId: string | null): void => {
  if (!isPostHogEnabled()) return
  if (userId) {
    posthog.identify(userId)
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

const bucketPrice = (price: number | null): string => {
  if (price === null || price === undefined) return 'unknown'
  if (price < 25) return '0-25'
  if (price < 100) return '25-100'
  if (price < 500) return '100-500'
  return '500+'
}

// ---------------------------------------------------------------------------
// Tier 1: Core Actions
// ---------------------------------------------------------------------------

const trackSignUp = () => trackEvent('sign_up', { method: 'email' })

const trackLogin = () => trackEvent('login', { method: 'email' })

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const analytics = {
  // Tier 1
  trackSignUp,
  trackLogin,
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

  // Tier 3
  trackFormFieldFocused,
  trackFormAbandoned,
  trackVerdictDetailOpened,
  trackVerdictRationaleExpanded,
  trackFilterApplied,
  trackProfileModalOpened,
  trackProfileModalAbandoned,
  trackProfileTabSwitched,
  trackEmailImportModalOpened,
  trackEmptyStateShown,
  trackNavMenuOpened,
  trackSharedVerdictViewed,
  trackSharedVerdictCtaClicked,
}

export { analytics }
