import { useEffect } from 'react'
import { LiquidButton, useModalAnimation } from './Kinematics'

type GuestPromptModalProps = {
  isOpen: boolean
  onClose: () => void
  onSignUp: () => void
}

export default function GuestPromptModal({
  isOpen,
  onClose,
  onSignUp,
}: GuestPromptModalProps) {
  const { shouldRender, backdropRef, contentRef } = useModalAnimation(isOpen)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!shouldRender) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Create an account"
      onClick={handleBackdropClick}
    >
      <div ref={contentRef} className="guest-prompt-modal">
        <button
          type="button"
          className="modal-close guest-prompt-close"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>

        <h2>Create an account to continue</h2>
        <p>
          Your verdict history, preferences, and progress are tied to this
          guest session. Sign up to keep them safe and access your full
          profile.
        </p>

        <div className="guest-prompt-actions">
          <LiquidButton className="primary" onClick={onSignUp}>
            Create account
          </LiquidButton>
          <LiquidButton className="ghost" onClick={onClose}>
            Stay as guest
          </LiquidButton>
        </div>
      </div>
    </div>
  )
}
