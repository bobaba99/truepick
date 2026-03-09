import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { analytics } from '../../hooks/useAnalytics'
import { ONBOARDING_STEPS } from './onboardingContent'
import { useOnboardingTutorial } from './useOnboardingTutorial'
import OnboardingStep from './OnboardingStep'
import { LiquidButton } from '../Kinematics'

type OnboardingTutorialProps = {
  userId: string | null
  hasVerdicts: boolean
  dataLoaded: boolean
  onNavigate: (route: string) => void
}

const TRANSITION_MS = 300

export default function OnboardingTutorial({
  userId,
  hasVerdicts,
  dataLoaded,
  onNavigate,
}: OnboardingTutorialProps) {
  const { isVisible, currentStep, totalSteps, goNext, goBack, dismiss } =
    useOnboardingTutorial(userId, hasVerdicts, dataLoaded)

  const [displayedStep, setDisplayedStep] = useState(currentStep)
  const [transitioning, setTransitioning] = useState(false)
  const [entering, setEntering] = useState(false)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const timerRef = useRef<number | null>(null)
  const enterRafRef = useRef<number | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  // Step transition: exit old → swap content → enter new
  useEffect(() => {
    if (currentStep === displayedStep) return

    setDirection(currentStep > displayedStep ? 'forward' : 'backward')
    setTransitioning(true)

    timerRef.current = window.setTimeout(() => {
      setDisplayedStep(currentStep)
      setTransitioning(false)
      setEntering(true)
    }, TRANSITION_MS)

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [currentStep, displayedStep])

  // Enter animation: once entering is set, wait one frame then activate
  useEffect(() => {
    if (!entering) return
    enterRafRef.current = requestAnimationFrame(() => {
      enterRafRef.current = requestAnimationFrame(() => {
        setEntering(false)
      })
    })
    return () => {
      if (enterRafRef.current !== null) cancelAnimationFrame(enterRafRef.current)
    }
  }, [entering])

  // Focus management: capture previous focus, move to modal, restore on close
  useEffect(() => {
    if (!isVisible) {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
      return
    }

    previousFocusRef.current = document.activeElement
    // Small delay to let portal render before focusing
    const focusTimer = window.setTimeout(() => {
      modalRef.current?.focus()
    }, 50)

    return () => window.clearTimeout(focusTimer)
  }, [isVisible])

  // Escape key to dismiss
  useEffect(() => {
    if (!isVisible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isVisible, dismiss])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) dismiss()
    },
    [dismiss],
  )

  const handleCtaClick = useCallback(
    (ctaRoute: string, stepId: string) => {
      analytics.trackOnboardingCtaClicked(stepId, ctaRoute)
      dismiss()
      onNavigate(ctaRoute)
    },
    [dismiss, onNavigate],
  )

  if (!isVisible) return null

  const step = ONBOARDING_STEPS[displayedStep]
  const isLastStep = currentStep >= totalSteps - 1
  const isFirstStep = currentStep <= 0

  const stepWrapperClass = transitioning
    ? `onboarding-step-exit ${direction === 'backward' ? 'reverse' : ''}`
    : entering
      ? `onboarding-step-enter ${direction === 'backward' ? 'reverse' : ''}`
      : 'onboarding-step-enter-active'

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to TruePick"
        tabIndex={-1}
      >
        <button
          type="button"
          className="onboarding-skip"
          onClick={dismiss}
          aria-label="Skip tutorial"
        >
          Skip
        </button>

        <div className="onboarding-body">
          <div className={`onboarding-step-wrapper ${stepWrapperClass}`}>
            <OnboardingStep
              iconKey={step.iconKey}
              title={step.title}
              body={step.body}
              ctaLabel={step.ctaLabel}
              onCtaClick={
                step.ctaRoute
                  ? () => handleCtaClick(step.ctaRoute!, step.id)
                  : undefined
              }
              privacyLink={step.privacyLink}
            />
          </div>

          <div className="onboarding-footer">
            <div className="onboarding-dots" aria-hidden="true">
              {ONBOARDING_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`onboarding-dot ${i === currentStep ? 'active' : ''}`}
                />
              ))}
            </div>
            <p className="visually-hidden" aria-live="polite">
              Step {currentStep + 1} of {totalSteps}: {ONBOARDING_STEPS[currentStep].title}
            </p>

            <div className="onboarding-nav">
              <button
                type="button"
                className="onboarding-back-btn"
                onClick={goBack}
                style={isFirstStep ? { visibility: 'hidden' } : undefined}
                aria-hidden={isFirstStep}
                tabIndex={isFirstStep ? -1 : 0}
              >
                Back
              </button>

              <LiquidButton
                type="button"
                className="onboarding-next-btn"
                onClick={goNext}
              >
                {isLastStep ? 'Get started' : 'Next'}
              </LiquidButton>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
