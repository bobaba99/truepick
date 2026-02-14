import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { SwipeOutcome, SwipeQueueItem, SwipeTiming } from '../api/core/types'
import { getUnratedPurchases, createSwipe, deleteSwipe } from '../api/purchase/swipeService'
import { GlassCard, LiquidButton } from '../components/Kinematics'

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

export default function Swipe({ session }: SwipeProps) {
  const [purchases, setPurchases] = useState<SwipeQueueItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [swiping, setSwiping] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null)
  const [status, setStatus] = useState<string>('')
  const [lastSwipe, setLastSwipe] = useState<LastSwipe | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [viewMode, setViewMode] = useState<SwipeFilterMode>('all')
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

  const renderUpcomingSection = () => {
    return (
      <div className="upcoming-section">
        <div className="upcoming-header">
          <div>
            <h1>Upcoming schedules</h1>
            <p>These purchases are scheduled but not due to swipe yet.</p>
          </div>
          {renderFilter()}
        </div>
        {upcomingFiltered.length === 0 ? (
          <div className="empty-card">
            {viewMode === 'all'
              ? 'No upcoming schedules yet.'
              : 'No upcoming schedules match this filter.'}
          </div>
        ) : (
          <div className="upcoming-grid">
            {upcomingFiltered.slice(0, 6).map((item) => (
              <GlassCard key={item.schedule_id} className="upcoming-card glass-panel">
                <span className="upcoming-title">{item.purchase.title}</span>
                <span className="upcoming-meta">
                  {formatTimingLabel(item.timing)} •{' '}
                  {new Date(item.scheduled_for).toLocaleDateString()}
                </span>
              </GlassCard>
            ))}
          </div>
        )}
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
      </p>

      {status && <div className="status error">{status}</div>}

      <div className="swipe-counter">{remaining} remaining</div>

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
              ${Number(currentPurchase.price).toFixed(2)}
            </span>
            <div className="swipe-meta">
              {currentPurchase.vendor && (
                <span>Vendor: {currentPurchase.vendor}</span>
              )}
              {currentPurchase.category && (
                <span>Category: {currentPurchase.category}</span>
              )}
              <span>
                Considered:{' '}
                {new Date(currentPurchase.purchase_date).toLocaleDateString()}
              </span>
              {currentItem && (
                <span>
                  Scheduled:{' '}
                  {new Date(currentItem.scheduled_for).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </GlassCard>

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
