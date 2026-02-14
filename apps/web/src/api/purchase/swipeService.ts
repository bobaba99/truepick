import { supabase } from '../core/supabaseClient'
import type { SwipeOutcome, SwipeQueueItem, SwipeTiming } from '../core/types'

type SwipeScheduleQueryRow = {
  id: string
  timing: string
  scheduled_for: string
  purchase: {
    id: string
    title: string
    price: number
    vendor: string | null
    category: string | null
    purchase_date: string
    source: string | null
    verdict_id: string | null
  }
}

export async function getUnratedPurchases(
  userId: string,
  options?: { includeFuture?: boolean },
): Promise<SwipeQueueItem[]> {
  const today = new Date().toISOString().split('T')[0]
  const includeFuture = options?.includeFuture ?? false

  let query = supabase
    .from('swipe_schedules')
    .select(
      'id, timing, scheduled_for, purchase:purchase_id (id, title, price, vendor, category, purchase_date, source, verdict_id)',
    )
    .eq('user_id', userId)
    .is('completed_at', null)
    .order('scheduled_for', { ascending: true })

  if (!includeFuture) {
    query = query.lte('scheduled_for', today)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as SwipeScheduleQueryRow[]

  // Get verdict decisions for purchases that came from verdicts
  const verdictIds = rows
    .map((row) => row.purchase.verdict_id)
    .filter((id): id is string => id !== null)

  let verdictDecisions: Record<string, string> = {}

  if (verdictIds.length > 0) {
    const { data: verdicts } = await supabase
      .from('verdicts')
      .select('id, user_decision')
      .in('id', verdictIds)

    verdictDecisions = (verdicts ?? []).reduce(
      (acc, v) => {
        acc[v.id] = v.user_decision
        return acc
      },
      {} as Record<string, string>,
    )
  }

  return rows.map((row) => {
    const verdictId = row.purchase.verdict_id
    const userDecision = verdictId ? verdictDecisions[verdictId] : null
    // "Regret not buying" applies to verdict purchases where user chose skip or hold
    const isRegretNotBuying =
      row.purchase.source === 'verdict' &&
      userDecision !== null &&
      userDecision !== 'bought'

    return {
      schedule_id: row.id,
      timing: row.timing as SwipeTiming,
      scheduled_for: row.scheduled_for,
      purchase: row.purchase,
      is_regret_not_buying: isRegretNotBuying,
    }
  })
}

export async function createSwipe(
  userId: string,
  purchaseId: string,
  outcome: SwipeOutcome,
  timing: SwipeTiming,
  scheduleId: string
): Promise<{ error: string | null; isDuplicate: boolean }> {
  const ratedAt = new Date().toISOString()
  const { error } = await supabase.from('swipes').insert({
    user_id: userId,
    purchase_id: purchaseId,
    schedule_id: scheduleId,
    timing,
    outcome,
    rated_at: ratedAt,
  })

  if (error) {
    const isDuplicate = error.code === '23505'
    return {
      error: isDuplicate ? 'Already rated this purchase.' : error.message,
      isDuplicate,
    }
  }

  const { error: scheduleError } = await supabase
    .from('swipe_schedules')
    .update({ completed_at: ratedAt })
    .eq('id', scheduleId)
    .eq('user_id', userId)

  if (scheduleError) {
    return { error: scheduleError.message, isDuplicate: false }
  }

  return { error: null, isDuplicate: false }
}

export async function deleteSwipe(
  userId: string,
  scheduleId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('swipes')
    .delete()
    .eq('user_id', userId)
    .eq('schedule_id', scheduleId)

  if (error) {
    return { error: error.message }
  }

  const { error: scheduleError } = await supabase
    .from('swipe_schedules')
    .update({ completed_at: null })
    .eq('id', scheduleId)
    .eq('user_id', userId)

  return { error: scheduleError?.message ?? null }
}
