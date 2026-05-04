export type DailyTotalRow = {
  source: string
  bmrCalories: number | null
  activeCalories: number | null
  totalCalories: number | null
  steps: number | null
  restingHr: number | null
}

export type WorkoutRow = {
  id: string
  source: string
  type: string
  startTime: Date
  endTime: Date
  durationMin: number
  calories: number | null
  isPrimary: boolean
  duplicateOf: string | null
}

export type FoodLogRow = {
  id: string
  kcal: number
}

export type WatchOffSignalLite = {
  workoutId: string
  watchOff: boolean
}

export type CicoInput = {
  dailyTotals: DailyTotalRow[]
  workouts: WorkoutRow[]
  foodLog: FoodLogRow[]
  watchOffSignals?: WatchOffSignalLite[]
}

export type CicoBreakdown = {
  date: string
  intake: number
  burn: number
  net: number
  baseSource: 'huawei' | 'oura' | 'none'
  baseTotal: number
  baseSourceWorkoutsSubtracted: number
  primaryWorkoutsAdded: number
  watchOffWorkoutsAdded: number
  flags: CicoFlag[]
}

export type CicoFlag =
  | 'no_daily_total'
  | 'no_food_log'
  | 'huawei_used'
  | 'oura_fallback'
  | 'watch_off_added'
