import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import type { SwipeOutcome, SwipeQueueItem } from '../api/core/types'
import { GlassCard } from './Kinematics'

const QUEUE_SWIPE_THRESHOLD = 60
const QUEUE_SWIPE_DOWN_THRESHOLD = 60

const formatTimingLabel = (timing: string) => {
  switch (timing) {
    case 'immediate': return 'Immediate'
    case 'day3': return '3 days'
    case 'week3': return '3 weeks'
    case 'month3': return '3 months'
    default: return timing
  }
}

type SwipeableQueueCardProps = {
  item: SwipeQueueItem
  isDue: boolean
  isDismissed: boolean
  onSwipe: (item: SwipeQueueItem, outcome: SwipeOutcome) => void
  formatScheduleDate: (value: string) => string
}

export default function SwipeableQueueCard({
  item,
  isDue,
  isDismissed,
  onSwipe,
  formatScheduleDate,
}: SwipeableQueueCardProps) {
  const cardNodeRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const [swipeOutcome, setSwipeOutcome] = useState<SwipeOutcome | null>(null)

  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
    if (cardNodeRef.current) {
      cardNodeRef.current.style.transition = 'none'
    }
  }, [])

  const onTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (!touchStart.current || !cardNodeRef.current) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStart.current.x
    const deltaY = touch.clientY - touchStart.current.y
    touchStart.current = null

    cardNodeRef.current.style.transition = ''
    cardNodeRef.current.style.transform = ''
    cardNodeRef.current.style.opacity = ''

    if (Math.abs(deltaX) > QUEUE_SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      const outcome: SwipeOutcome = deltaX < 0 ? 'regret' : 'satisfied'
      setSwipeOutcome(outcome)
      onSwipe(item, outcome)
    } else if (deltaY > QUEUE_SWIPE_DOWN_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
      setSwipeOutcome('not_sure')
      onSwipe(item, 'not_sure')
    }
  }, [item, onSwipe])

  // Attach non-passive touchmove so preventDefault can block page scroll during horizontal swipe
  useEffect(() => {
    const node = cardNodeRef.current
    if (!node) return

    const handleMove = (e: globalThis.TouchEvent) => {
      if (!touchStart.current || !cardNodeRef.current) return
      const touch = e.touches[0]
      const deltaX = touch.clientX - touchStart.current.x
      const deltaY = touch.clientY - touchStart.current.y

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        e.preventDefault()
      }

      const rotation = deltaX * 0.06
      const opacity = Math.max(0.5, 1 - Math.abs(deltaX) / 200)
      cardNodeRef.current.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`
      cardNodeRef.current.style.opacity = String(opacity)
    }

    node.addEventListener('touchmove', handleMove, { passive: false })
    return () => node.removeEventListener('touchmove', handleMove)
  }, [])

  const dismissClass = isDismissed
    ? swipeOutcome === 'regret'
      ? 'queue-card-dismissed-left'
      : swipeOutcome === 'not_sure'
        ? 'queue-card-dismissed-down'
        : 'queue-card-dismissed-right'
    : ''

  return (
    <div
      ref={cardNodeRef}
      className={`queue-card-wrapper ${dismissClass}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <GlassCard className="upcoming-card glass-panel">
        <span className="upcoming-title">{item.purchase.title}</span>
        <span className="upcoming-meta">
          {formatTimingLabel(item.timing)} •{' '}
          {isDue ? 'Due now' : formatScheduleDate(item.scheduled_for)}
        </span>
      </GlassCard>
    </div>
  )
}
