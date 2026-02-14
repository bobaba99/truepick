import { supabase } from '../core/supabaseClient'
import type { Stats } from '../core/types'

export async function getSwipeStats(userId: string): Promise<Stats> {
  const stats: Stats = {
    swipesCompleted: 0,
    regretRate: 0,
    activeHolds: 0,
  }

  // Load swipe stats
  const { data: swipes, error: swipesError } = await supabase
    .from('swipes')
    .select('outcome')
    .eq('user_id', userId)

  if (!swipesError && swipes) {
    const total = swipes.length
    const regrets = swipes.filter((s) => s.outcome === 'regret').length
    const satisfied = swipes.filter((s) => s.outcome === 'satisfied').length
    const rated = regrets + satisfied
    stats.swipesCompleted = total
    stats.regretRate = rated > 0 ? Math.round((regrets / rated) * 100) : 0
  }

  // Load active holds (verdicts with hold_release_at in the future)
  const { data: holds, error: holdsError } = await supabase
    .from('verdicts')
    .select('id')
    .eq('user_id', userId)
    .eq('predicted_outcome', 'hold')
    .gt('hold_release_at', new Date().toISOString())
    .is('user_proceeded', null)

  if (!holdsError && holds) {
    stats.activeHolds = holds.length
  }

  return stats
}
