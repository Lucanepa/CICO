import type { Database } from '@cico/db'
import { schema } from '@cico/db'
import { and, asc, between, eq } from 'drizzle-orm'

export type WatchOffSignal = {
  workoutId: string
  watchOff: boolean
  reason: 'no_huawei_hr' | 'flatline' | 'elevated' | 'insufficient_samples'
  sampleCount: number
  meanBpm?: number
  maxBpm?: number
  baselineBpm?: number
}

export type WatchOffOptions = {
  /** Tolerance over resting HR before we consider the stream "elevated". */
  flatlineMarginBpm: number
  /** Minimum samples in the window required to make a confident call. */
  minSamples: number
}

export const DEFAULT_WATCH_OFF_OPTIONS: WatchOffOptions = {
  flatlineMarginBpm: 12,
  minSamples: 3,
}

/**
 * Decides whether the Huawei watch was off the wrist during a workout.
 *
 * The rule is workout-agnostic: if Oura logged a workout and the
 * Huawei HR stream over the same window is flat at resting HR (within
 * noise), the watch was off and Oura's calorie estimate should be
 * added on top of Huawei's daily total. If Huawei HR shows elevation,
 * Huawei already counted those calories.
 *
 * Caller decides what to do with the signal — this function only
 * inspects the data and returns a verdict.
 */
export async function detectWatchOff(
  db: Database,
  userId: string,
  workout: { id: string; startTime: Date; endTime: Date },
  baselineBpm: number,
  opts: WatchOffOptions = DEFAULT_WATCH_OFF_OPTIONS,
): Promise<WatchOffSignal> {
  const samples = await db
    .select({ bpm: schema.heartRateSamples.bpm })
    .from(schema.heartRateSamples)
    .where(
      and(
        eq(schema.heartRateSamples.userId, userId),
        eq(schema.heartRateSamples.source, 'huawei'),
        between(schema.heartRateSamples.timestamp, workout.startTime, workout.endTime),
      ),
    )
    .orderBy(asc(schema.heartRateSamples.timestamp))

  if (samples.length === 0) {
    return {
      workoutId: workout.id,
      watchOff: false,
      reason: 'no_huawei_hr',
      sampleCount: 0,
    }
  }

  if (samples.length < opts.minSamples) {
    return {
      workoutId: workout.id,
      watchOff: false,
      reason: 'insufficient_samples',
      sampleCount: samples.length,
      baselineBpm,
    }
  }

  const bpms = samples.map((s) => s.bpm)
  const mean = bpms.reduce((a, b) => a + b, 0) / bpms.length
  const max = Math.max(...bpms)

  const ceiling = baselineBpm + opts.flatlineMarginBpm
  const watchOff = max <= ceiling && mean <= baselineBpm + opts.flatlineMarginBpm / 2

  return {
    workoutId: workout.id,
    watchOff,
    reason: watchOff ? 'flatline' : 'elevated',
    sampleCount: samples.length,
    meanBpm: Math.round(mean * 10) / 10,
    maxBpm: max,
    baselineBpm,
  }
}
