import { useCallback, useEffect, useRef, useState } from 'react'
import { analytics } from '../../hooks/useAnalytics'
import { ONBOARDING_STEPS } from './onboardingContent'

const STORAGE_PREFIX = 'truepick_onboarding_completed_'

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function isCompleted(userId: string): boolean {
  return localStorage.getItem(getStorageKey(userId)) === 'true'
}

function markCompleted(userId: string): void {
  localStorage.setItem(getStorageKey(userId), 'true')
}

export function clearOnboardingCompletion(userId: string): void {
  localStorage.removeItem(getStorageKey(userId))
}

type UseOnboardingTutorialResult = {
  isVisible: boolean
  currentStep: number
  totalSteps: number
  goNext: () => void
  goBack: () => void
  dismiss: () => void
}

export function useOnboardingTutorial(
  userId: string | null,
  hasVerdicts: boolean,
  dataLoaded: boolean,
): UseOnboardingTutorialResult {
  const totalSteps = ONBOARDING_STEPS.length
  const startTrackedRef = useRef(false)

  const [currentStep, setCurrentStep] = useState(0)
  // Start dismissed — only open once async data confirms no verdicts
  const [dismissed, setDismissed] = useState(true)

  // Evaluate visibility once data is loaded
  useEffect(() => {
    if (!dataLoaded || !userId) {
      setDismissed(true)
      return
    }
    if (hasVerdicts) {
      setDismissed(true)
      return
    }
    setDismissed(isCompleted(userId))
  }, [userId, hasVerdicts, dataLoaded])

  const isVisible = !dismissed

  // Track onboarding_started once when first shown
  useEffect(() => {
    if (!isVisible || startTrackedRef.current) return
    startTrackedRef.current = true
    analytics.trackOnboardingStarted()
    analytics.trackOnboardingStepViewed(0, ONBOARDING_STEPS[0].id)
  }, [isVisible])

  const dismiss = useCallback(() => {
    if (userId) markCompleted(userId)
    analytics.trackOnboardingDismissed(currentStep)
    setDismissed(true)
    setCurrentStep(0)
  }, [userId, currentStep])

  const goNext = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      // Last step — complete onboarding
      if (userId) markCompleted(userId)
      analytics.trackOnboardingCompleted(totalSteps)
      setDismissed(true)
      setCurrentStep(0)
      return
    }

    const nextStep = currentStep + 1
    setCurrentStep(nextStep)
    analytics.trackOnboardingStepViewed(nextStep, ONBOARDING_STEPS[nextStep].id)
  }, [currentStep, totalSteps, userId])

  const goBack = useCallback(() => {
    if (currentStep <= 0) return

    const prevStep = currentStep - 1
    setCurrentStep(prevStep)
    analytics.trackOnboardingStepViewed(prevStep, ONBOARDING_STEPS[prevStep].id)
  }, [currentStep])

  return { isVisible, currentStep, totalSteps, goNext, goBack, dismiss }
}
