import { and, eq, gte, lte } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'
import { decidePrimaries } from './primary.js'
import { DEFAULT_DEDUP_OPTIONS, type DedupOptions, type WorkoutForDedup } from './types.js'

export type DedupResult = {
  clusters: number
  primariesAssigned: number
  duplicatesMarked: number
}

/**
 * Recomputes is_primary + duplicate_of across a date range. Idempotent:
 * running it twice with no underlying data change yields the same set
 * of primary/duplicate assignments.
 *
 * Strategy:
 *   1. Pull all workouts in the window for the user.
 *   2. Cluster by HR-window overlap (>= minOverlapRatio).
 *   3. Pick a primary per cluster (manual pin > source priority > heuristics).
 *   4. Persist is_primary / duplicate_of as a single transaction.
 *
 * Manual pins (existing is_primary=true with duplicate_of=null) are
 * respected so the UI's "use this one instead" override survives
 * subsequent dedup runs.
 */
export async function dedupWorkoutsForWindow(
  db: Database,
  userId: string,
  startDate: string,
  endDate: string,
  opts: DedupOptions = DEFAULT_DEDUP_OPTIONS,
): Promise<DedupResult> {
  const rows = await db
    .select({
      id: schema.workouts.id,
      userId: schema.workouts.userId,
      date: schema.workouts.date,
      startTime: schema.workouts.startTime,
      endTime: schema.workouts.endTime,
      source: schema.workouts.source,
      type: schema.workouts.type,
      durationMin: schema.workouts.durationMin,
      calories: schema.workouts.calories,
      isPrimary: schema.workouts.isPrimary,
      duplicateOf: schema.workouts.duplicateOf,
    })
    .from(schema.workouts)
    .where(
      and(
        eq(schema.workouts.userId, userId),
        gte(schema.workouts.date, startDate),
        lte(schema.workouts.date, endDate),
      ),
    )

  const workouts: WorkoutForDedup[] = rows
  const decisions = decidePrimaries(workouts, opts)

  let primariesAssigned = 0
  let duplicatesMarked = 0

  await db.transaction(async (tx) => {
    for (const decision of decisions) {
      await tx
        .update(schema.workouts)
        .set({ isPrimary: true, duplicateOf: null })
        .where(eq(schema.workouts.id, decision.primaryId))
      primariesAssigned++

      for (const dupId of decision.duplicateIds) {
        await tx
          .update(schema.workouts)
          .set({ isPrimary: false, duplicateOf: decision.primaryId })
          .where(eq(schema.workouts.id, dupId))
        duplicatesMarked++
      }
    }
  })

  return { clusters: decisions.length, primariesAssigned, duplicatesMarked }
}

export { decidePrimaries } from './primary.js'
export { clusterByOverlap, overlapRatio } from './overlap.js'
export { detectWatchOff, DEFAULT_WATCH_OFF_OPTIONS } from './watch-off.js'
export type { WatchOffSignal, WatchOffOptions } from './watch-off.js'
export type { DedupOptions, WorkoutForDedup } from './types.js'
