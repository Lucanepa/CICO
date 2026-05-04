import type { DedupOptions, WorkoutForDedup } from './types.js'
import { clusterByOverlap } from './overlap.js'

export type PrimaryDecision = {
  primaryId: string
  duplicateIds: string[]
}

/**
 * Group workouts by overlap and pick a primary per cluster.
 *
 * Picking strategy:
 *   1. Manual override: if any workout in the cluster already has
 *      isPrimary=true, keep it. Lets the UI pin a choice.
 *   2. Source priority: earliest source in opts.sourcePriority wins.
 *   3. Tiebreak: longer duration, then larger calories, then earliest
 *      startTime, then lexicographic id.
 */
export function decidePrimaries(
  workouts: WorkoutForDedup[],
  opts: DedupOptions,
): PrimaryDecision[] {
  const clusters = clusterByOverlap(workouts, opts.minOverlapRatio)
  const decisions: PrimaryDecision[] = []
  for (const cluster of clusters) {
    if (cluster.length === 0) continue
    const pinned = cluster.find((w) => w.isPrimary && w.duplicateOf == null)
    const primary = pinned ?? pickPrimary(cluster, opts)
    decisions.push({
      primaryId: primary.id,
      duplicateIds: cluster.filter((w) => w.id !== primary.id).map((w) => w.id),
    })
  }
  return decisions
}

function pickPrimary(cluster: WorkoutForDedup[], opts: DedupOptions): WorkoutForDedup {
  const rank = (w: WorkoutForDedup) => {
    const idx = opts.sourcePriority.indexOf(w.source)
    return idx < 0 ? opts.sourcePriority.length : idx
  }
  return [...cluster].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    if (b.durationMin !== a.durationMin) return b.durationMin - a.durationMin
    const ac = a.calories ?? 0
    const bc = b.calories ?? 0
    if (bc !== ac) return bc - ac
    if (a.startTime.getTime() !== b.startTime.getTime()) {
      return a.startTime.getTime() - b.startTime.getTime()
    }
    return a.id.localeCompare(b.id)
  })[0]!
}
