import { useEffect, useRef, useState } from 'react'

const STATUS_MESSAGES = [
  'Analyzing your spending patterns...',
  'Cross-referencing with your values...',
  'Crunching the numbers...',
  'Consulting your purchase history...',
  'Weighing the long-term impact...',
  'Checking for impulse signals...',
  'Running regret prediction models...',
  'Almost there...',
]

const CYCLE_INTERVAL_MS = 3_000

type EvaluatingModalProps = {
  isOpen: boolean
}

export default function EvaluatingModal({ isOpen }: EvaluatingModalProps) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setMessageIndex(0)
      setFading(false)
      setElapsedSeconds(0)
      startRef.current = null
      return
    }

    startRef.current = Date.now()

    const timerInterval = window.setInterval(() => {
      if (startRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startRef.current) / 1000))
      }
    }, 1000)

    const messageInterval = window.setInterval(() => {
      setFading(true)
      window.setTimeout(() => {
        setMessageIndex((previous) => (previous + 1) % STATUS_MESSAGES.length)
        setFading(false)
      }, 400)
    }, CYCLE_INTERVAL_MS)

    return () => {
      window.clearInterval(timerInterval)
      window.clearInterval(messageInterval)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-label="Evaluating purchase">
      <div className="eval-modal-body">
        <div className="eval-spinner" />
        <p className={`eval-status-text ${fading ? 'eval-status-fading' : ''}`}>
          {STATUS_MESSAGES[messageIndex]}
        </p>
        {elapsedSeconds > 0 && (
          <p className="eval-elapsed">{elapsedSeconds}s</p>
        )}
      </div>
    </div>
  )
}
