import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { SwipeOutcome, SwipeQueueItem, SwipeTiming } from '../api/core/types'
import { getUnratedPurchases, createSwipe, deleteSwipe } from '../api/purchase/swipeService'
import { GlassCard, LiquidButton } from '../components/Kinematics'
import { useUserFormatting } from '../preferences/UserPreferencesContext'

type SwipeProps = {
  session: Session | null
}

type SwipeDirection = 'left' | 'right' | 'unsure' | null

type LastSwipe = {
  scheduleId: string
  timing: SwipeTiming
  purchaseTitle: string
  outcome: SwipeOutcome
}

type SwipeFilterMode = 'all' | SwipeTiming

const UNDO_TIMEOUT_MS = 3000
const QUEUE_SWIPE_THRESHOLD = 60
const QUEUE_SWIPE_DOWN_THRESHOLD = 60

const formatTimingLabel = (timing: SwipeTiming) => {
  switch (timing) {
    case 'immediate':
      return 'Immediate'
    case 'day3':
      return '3 days'
    case 'week3':
      return '3 weeks'
    case 'month3':
      return '3 months'
    default:
      return timing
  }
}

const formatOutcomeLabel = (outcome: SwipeOutcome) => {
  if (outcome === 'not_sure') {
    return 'not sure'
  }
  return outcome
}

function SwipeableQueueCard({
  item,
  isDue,
  isDismissed,
  onSwipe,
}: {
  item: SwipeQueueItem
  isDue: boolean
  isDismissed: boolean
  onSwipe: (item: SwipeQueueItem, outcome: SwipeOutcome) => void
}) {
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

  // Attach non-passive touchmove
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
          {isDue ? 'Due now' : new Date(item.scheduled_for).toLocaleDateString()}
        </span>
      </GlassCard>
    </div>
  )
}

export default function Swipe({ session }: SwipeProps) {
  const { formatCurrency, formatDate } = useUserFormatting()
  const [purchases, setPurchases] = useState<SwipeQueueItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [swiping, setSwiping] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null)
  const [status, setStatus] = useState<string>('')
  const [lastSwipe, setLastSwipe] = useState<LastSwipe | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [viewMode, setViewMode] = useState<SwipeFilterMode>('all')
  const [cardDetailsOpen, setCardDetailsOpen] = useState(false)
  const undoTimerRef = useRef<number | null>(null)

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }, [])

  const clearLastSwipe = useCallback(() => {
    setLastSwipe(null)
    clearUndoTimer()
  }, [clearUndoTimer])

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const handleQueueSwipe = useCallback(
    async (item: SwipeQueueItem, outcome: SwipeOutcome) => {
      if (!session) return

      setCardDetailsOpen(false)

      // Optimistically mark as dismissed for animation
      setDismissedIds((prev) => {
        const next = new Set(prev)
        next.add(item.schedule_id)
        return next
      })

      const { error } = await createSwipe(
        session.user.id,
        item.purchase.id,
        outcome,
        item.timing,
        item.schedule_id,
      )

      if (error) {
        // Revert on failure
        setDismissedIds((prev) => {
          const next = new Set(prev)
          next.delete(item.schedule_id)
          return next
        })
        setStatus(error)
        return
      }

      // Remove from purchases after animation completes
      setTimeout(() => {
        setPurchases((prev) => prev.filter((p) => p.schedule_id !== item.schedule_id))
        setDismissedIds((prev) => {
          const next = new Set(prev)
          next.delete(item.schedule_id)
          return next
        })
      }, 300)
    },
    [session],
  )

  const loadUnratedPurchases = useCallback(async () => {
    if (!session) return

    setLoading(true)
    setStatus('')
    clearLastSwipe()

    try {
      const data = await getUnratedPurchases(session.user.id, { includeFuture: true })
      setPurchases(data)
      setCurrentIndex(0)
    } catch {
      setStatus('Failed to load purchases.')
    } finally {
      setLoading(false)
    }
  }, [session, clearLastSwipe])

  useEffect(() => {
    void loadUnratedPurchases()
  }, [loadUnratedPurchases])

  const today = new Date().toISOString().split('T')[0]
  const matchesFilter = (item: SwipeQueueItem) =>
    viewMode === 'all' ? true : item.timing === viewMode

  const duePurchases = purchases.filter((item) => item.scheduled_for <= today)
  const dueFiltered = duePurchases.filter(matchesFilter)
  const upcomingPurchases = purchases
    .filter((item) => item.scheduled_for > today)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.scheduled_for).getTime() -
        new Date(b.scheduled_for).getTime(),
    )
  const upcomingFiltered = upcomingPurchases.filter(matchesFilter)
  const currentItem = duePurchases[currentIndex] ?? null
  const currentPurchase = currentItem?.purchase ?? null
  const remaining = duePurchases.length - currentIndex
  const totalDue = duePurchases.length
  const progress = totalDue > 0 ? (currentIndex / totalDue) * 100 : 0

  const handleFilterChange = (mode: SwipeFilterMode) => {
    setViewMode(mode)
  }

  const renderFilter = () => (
    <div className="swipe-filter">
      {[
        { value: 'all', label: 'All' },
        { value: 'immediate', label: 'Immediate' },
        { value: 'day3', label: '3 days' },
        { value: 'week3', label: '3 weeks' },
        { value: 'month3', label: '3 months' },
      ].map((option) => (
        <LiquidButton
          key={option.value}
          type="button"
          className={`filter-chip ${viewMode === option.value ? 'active' : ''}`}
          onClick={() => handleFilterChange(option.value as SwipeFilterMode)}
        >
          {option.label}
        </LiquidButton>
      ))}
    </div>
  )

  const renderQueueCard = (item: SwipeQueueItem) => {
    const isDue = item.scheduled_for <= today
    const isDismissed = dismissedIds.has(item.schedule_id)

    return (
      <SwipeableQueueCard
        key={item.schedule_id}
        item={item}
        isDue={isDue}
        isDismissed={isDismissed}
        onSwipe={handleQueueSwipe}
      />
    )
  }

  const renderUpcomingSection = () => {
    const allFiltered = [...dueFiltered, ...upcomingFiltered]
      .filter((item) => !dismissedIds.has(item.schedule_id))

    if (allFiltered.length === 0) {
      return (
        <div className="upcoming-section upcoming-section--empty">
          <span className="upcoming-empty-hint">
            {viewMode === 'all'
              ? 'No schedules'
              : `No ${formatTimingLabel(viewMode as SwipeTiming).toLowerCase()} schedules`}
          </span>
        </div>
      )
    }

    return (
      <div className="upcoming-section">
        <div className="upcoming-grid">
          {allFiltered.slice(0, 6).map(renderQueueCard)}
        </div>
      </div>
    )
  }

  const handleUndo = useCallback(async () => {
    if (!session || !lastSwipe || undoing) return

    setUndoing(true)
    clearUndoTimer()

    const { error } = await deleteSwipe(session.user.id, lastSwipe.scheduleId)

    if (error) {
      setStatus('Failed to undo.')
      setUndoing(false)
      return
    }

    setCurrentIndex((prev) => Math.max(0, prev - 1))
    setLastSwipe(null)
    setUndoing(false)
  }, [session, lastSwipe, undoing, clearUndoTimer])

  const handleSwipe = useCallback(
    async (outcome: SwipeOutcome) => {
      if (!session || !currentPurchase || !currentItem || swiping || undoing) return

      // Capture purchase data before any state changes
      const swipedPurchase = {
        id: currentPurchase.id,
        title: currentPurchase.title,
        scheduleId: currentItem.schedule_id,
        timing: currentItem.timing,
      }

      // Clear any pending undo before new swipe
      clearLastSwipe()

      setSwiping(true)
      setSwipeDirection(
        outcome === 'satisfied'
          ? 'right'
          : outcome === 'regret'
            ? 'left'
            : 'unsure',
      )
      setStatus('')

      const { error } = await createSwipe(
        session.user.id,
        swipedPurchase.id,
        outcome,
        swipedPurchase.timing,
        swipedPurchase.scheduleId,
      )

      if (error) {
        setStatus(error)
        setSwiping(false)
        setSwipeDirection(null)
        return
      }

      // Brief delay for animation, then update state
      const animationDelay = outcome === 'not_sure' ? 2000 : 300

      setTimeout(() => {
        // Set undo state FIRST, before changing index
        setLastSwipe({
          scheduleId: swipedPurchase.scheduleId,
          timing: swipedPurchase.timing,
          purchaseTitle: swipedPurchase.title,
          outcome,
        })

        setCurrentIndex((prev) => prev + 1)
        setCardDetailsOpen(false)
        setSwiping(false)
        setSwipeDirection(null)

        // Auto-clear undo after timeout
        undoTimerRef.current = window.setTimeout(() => {
          setLastSwipe(null)
        }, UNDO_TIMEOUT_MS)
      }, animationDelay)
    },
    [session, currentPurchase, currentItem, swiping, undoing, clearLastSwipe],
  )

  const handleRegret = useCallback(() => {
    void handleSwipe('regret')
  }, [handleSwipe])

  const handleSatisfied = useCallback(() => {
    void handleSwipe('satisfied')
  }, [handleSwipe])

  const handleNotSure = useCallback(() => {
    void handleSwipe('not_sure')
  }, [handleSwipe])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        if (lastSwipe && !undoing) {
          event.preventDefault()
          void handleUndo()
        }
        return
      }

      if (!currentPurchase || swiping) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleRegret()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleSatisfied()
      } else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleNotSure()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    currentPurchase,
    swiping,
    handleRegret,
    handleSatisfied,
    handleNotSure,
    lastSwipe,
    undoing,
    handleUndo,
  ])

  // Touch swipe gesture support
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((event: ReactTouchEvent) => {
    if (swiping || !currentPurchase) return
    const touch = event.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    if (cardRef.current) {
      cardRef.current.style.transition = 'none'
    }
  }, [swiping, currentPurchase])

  // Ref to track swiping state inside native listener without stale closure
  const swipingRef = useRef(swiping)
  swipingRef.current = swiping

  // Attach touchmove with { passive: false } so preventDefault works on mobile
  useEffect(() => {
    const node = cardRef.current
    if (!node) return

    const onTouchMove = (event: globalThis.TouchEvent) => {
      if (!touchStartRef.current || !cardRef.current || swipingRef.current) return
      const touch = event.touches[0]
      const deltaX = touch.clientX - touchStartRef.current.x
      const deltaY = touch.clientY - touchStartRef.current.y

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        event.preventDefault()
      }

      const rotation = deltaX * 0.08
      const opacity = Math.max(0.4, 1 - Math.abs(deltaX) / 300)
      cardRef.current.style.transform = `translateX(${deltaX}px) rotate(${rotation}deg)`
      cardRef.current.style.opacity = String(opacity)
    }

    node.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => node.removeEventListener('touchmove', onTouchMove)
  }, [currentPurchase])

  const handleTouchEnd = useCallback((event: ReactTouchEvent) => {
    if (!touchStartRef.current || !cardRef.current || swiping) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    touchStartRef.current = null

    const SWIPE_THRESHOLD = 80
    const SWIPE_DOWN_THRESHOLD = 100

    // Reset card inline styles
    cardRef.current.style.transition = ''
    cardRef.current.style.transform = ''
    cardRef.current.style.opacity = ''

    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        handleRegret()
      } else {
        handleSatisfied()
      }
    } else if (deltaY > SWIPE_DOWN_THRESHOLD && Math.abs(deltaY) > Math.abs(deltaX)) {
      handleNotSure()
    }
  }, [swiping, handleRegret, handleSatisfied, handleNotSure])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        clearTimeout(undoTimerRef.current)
      }
    }
  }, [])

  if (loading) {
    return (
      <section className="route-content">
        <h1>Swipe queue</h1>
        <p>Loading your purchases...</p>
      </section>
    )
  }

  if (purchases.length === 0) {
    return (
      <section className="route-content">
        {renderFilter()}
        {renderUpcomingSection()}
        <h1>Swipe queue</h1>
        <p>Rate your past purchases to build your regret patterns.</p>
        <div className="empty-card">
          <span>No purchases to rate. Add some in your Profile first.</span>
        </div>
      </section>
    )
  }

  if (!currentPurchase) {
    return (
      <section className="route-content">
        {renderFilter()}
        {renderUpcomingSection()}
        <h1>Swipe queue</h1>
        <p>
          {duePurchases.length === 0
            ? 'No swipes due yet.'
            : "You've rated all your purchases."}
        </p>

        {lastSwipe && (
          <div className="undo-toast">
            <span>
              Marked "{lastSwipe.purchaseTitle}" as{' '}
              <strong>{formatOutcomeLabel(lastSwipe.outcome)}</strong>
            </span>
            <LiquidButton
              type="button"
              className="undo-button"
              onClick={() => void handleUndo()}
              disabled={undoing}
            >
              {undoing ? 'Undoing...' : 'Undo'}
            </LiquidButton>
          </div>
        )}

        <div className="swipe-complete">
          <span className="complete-icon">✓</span>
          <p>
            {upcomingPurchases.length > 0
              ? 'No swipes due yet. Upcoming schedules are listed above.'
              : 'All caught up! Add more purchases in your Profile to continue.'}
          </p>
          <LiquidButton
            className="ghost"
            type="button"
            onClick={() => void loadUnratedPurchases()}
          >
            Refresh
          </LiquidButton>
        </div>
      </section>
    )
  }

  return (
    <section className="route-content">
      {renderFilter()}
      {renderUpcomingSection()}

      <h1>Swipe queue</h1>
      {totalDue > 0 && (
        <div className="swipe-progress-container">
          <div
            className="swipe-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <p>
        {currentItem?.is_regret_not_buying
          ? 'Do you regret NOT buying this? Left = yes (regret), Right = no (satisfied), Down = not sure.'
          : 'Rate your past purchases. Left = regret, Right = satisfied, Down = not sure.'}
        <span className="keyboard-hint"> Use ← → ↓ or N</span>
        <span className="swipe-touch-hint"> Swipe left / right / down on the card</span>
      </p>

      {status && <div className="status error">{status}</div>}

      <div className="swipe-counter">{remaining} remaining</div>

      {lastSwipe && (
        <div className="undo-toast">
          <span>
            <strong>{formatOutcomeLabel(lastSwipe.outcome)}</strong>
            {' — '}
            <span className="undo-title">{lastSwipe.purchaseTitle}</span>
          </span>
          <LiquidButton
            type="button"
            className="undo-button"
            onClick={() => void handleUndo()}
            disabled={undoing}
          >
            {undoing ? 'Undoing...' : 'Undo'}
          </LiquidButton>
        </div>
      )}

      <div className="swipe-container">
        <LiquidButton
          className="swipe-button regret"
          type="button"
          onClick={handleRegret}
          disabled={swiping}
          aria-label={currentItem?.is_regret_not_buying ? 'Yes, regret' : 'Regret'}
        >
          <span className="swipe-icon">←</span>
          <span className="swipe-label">
            {currentItem?.is_regret_not_buying ? 'Yes' : 'Regret'}
          </span>
        </LiquidButton>

        <div
          ref={cardRef}
          className="swipe-card-touch-wrapper"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <GlassCard
            className={`swipe-card ${swipeDirection ? `swiping-${swipeDirection}` : ''} ${currentItem?.is_regret_not_buying ? 'regret-not-buying' : ''}`}
          >
            <div className="swipe-card-content">
              {currentItem?.is_regret_not_buying && (
                <div className="regret-not-buying-label">
                  Did you regret NOT buying this?
                </div>
              )}
              <div className="swipe-title-row">
                <span className="swipe-title">{currentPurchase.title}</span>
                {currentItem && (
                  <span className="timing-chip">
                    {formatTimingLabel(currentItem.timing)}
                  </span>
                )}
              </div>
              <span className="swipe-price">
                {formatCurrency(Number(currentPurchase.price))}
              </span>
              {currentPurchase.vendor && (
                <span className="swipe-vendor">{currentPurchase.vendor}</span>
              )}
              {(currentPurchase.category || currentItem) && (
                <>
                  <button
                    type="button"
                    className="swipe-details-toggle"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCardDetailsOpen((prev) => !prev)
                    }}
                  >
                    {cardDetailsOpen ? 'Less' : 'Details'}
                  </button>
                  <div className={`collapsible ${cardDetailsOpen ? 'open' : ''}`}>
                    <div>
                      <div className="swipe-meta">
                        {currentPurchase.category && (
                          <span>Category: {currentPurchase.category}</span>
                        )}
                        <span>
                          Considered:{' '}
                          {formatDate(currentPurchase.purchase_date)}
                        </span>
                        {currentItem && (
                          <span>
                            Scheduled:{' '}
                            {formatDate(currentItem.scheduled_for)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </GlassCard>
        </div>

        <LiquidButton
          className="swipe-button satisfied"
          type="button"
          onClick={handleSatisfied}
          disabled={swiping}
          aria-label={currentItem?.is_regret_not_buying ? 'No regret' : 'Satisfied'}
        >
          <span className="swipe-icon">→</span>
          <span className="swipe-label">
            {currentItem?.is_regret_not_buying ? 'No' : 'Satisfied'}
          </span>
        </LiquidButton>
      </div>

      <div className="swipe-secondary">
        <LiquidButton
          className="swipe-button unsure"
          type="button"
          onClick={handleNotSure}
          disabled={swiping}
          aria-label="Not sure"
        >
          <span className="swipe-icon">↓</span>
          <span className="swipe-label">Not sure</span>
        </LiquidButton>
      </div>

    </section>
  )
}
