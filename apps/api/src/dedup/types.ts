export type WorkoutForDedup = {
  id: string
  userId: string
  date: string
  startTime: Date
  endTime: Date
  source: string
  type: string
  durationMin: number
  calories: number | null
  isPrimary: boolean
  duplicateOf: string | null
}

export type DedupOptions = {
  /** Two workouts overlap "enough" to be considered the same activity. */
  minOverlapRatio: number
  /** Source priority — earlier = preferred as primary. */
  sourcePriority: string[]
}

export const DEFAULT_DEDUP_OPTIONS: DedupOptions = {
  minOverlapRatio: 0.5,
  sourcePriority: ['strava', 'oura', 'frontier_x', 'huawei', 'manual'],
}
