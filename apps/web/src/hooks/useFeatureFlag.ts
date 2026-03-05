/**
 * PostHog feature flag hooks
 *
 * Returns the value of a PostHog feature flag.
 * Returns the fallback value when PostHog is disabled or the flag is not loaded.
 */

import { useCallback, useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { isPostHogEnabled } from './useAnalytics'

export function useFeatureFlag(flagKey: string, fallback: boolean = false): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (!isPostHogEnabled()) return fallback
    const value = posthog.isFeatureEnabled(flagKey)
    return value ?? fallback
  })

  const handleFlagsLoaded = useCallback(() => {
    const value = posthog.isFeatureEnabled(flagKey)
    setEnabled(value ?? fallback)
  }, [flagKey, fallback])

  useEffect(() => {
    if (!isPostHogEnabled()) {
      setEnabled(fallback)
      return
    }

    posthog.onFeatureFlags(handleFlagsLoaded)
  }, [fallback, handleFlagsLoaded])

  return enabled
}

export function useFeatureFlagPayload<T = unknown>(flagKey: string): T | undefined {
  const [payload, setPayload] = useState<T | undefined>(() => {
    if (!isPostHogEnabled()) return undefined
    return posthog.getFeatureFlagPayload(flagKey) as T | undefined
  })

  const handleFlagsLoaded = useCallback(() => {
    setPayload(posthog.getFeatureFlagPayload(flagKey) as T | undefined)
  }, [flagKey])

  useEffect(() => {
    if (!isPostHogEnabled()) {
      setPayload(undefined)
      return
    }

    posthog.onFeatureFlags(handleFlagsLoaded)
  }, [handleFlagsLoaded])

  return payload
}
