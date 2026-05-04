export type OuraDailyActivity = {
  id: string
  day: string
  steps: number
  active_calories: number
  total_calories: number
  resting_heart_rate?: number | null
  timestamp: string
}

export type OuraDailySleep = {
  id: string
  day: string
  score?: number | null
  contributors?: Record<string, number>
  timestamp: string
}

export type OuraSleepSession = {
  id: string
  day: string
  bedtime_start: string
  bedtime_end: string
  total_sleep_duration?: number | null
  deep_sleep_duration?: number | null
  rem_sleep_duration?: number | null
  light_sleep_duration?: number | null
  efficiency?: number | null
  average_hrv?: number | null
}

export type OuraWorkout = {
  id: string
  activity: string
  start_datetime: string
  end_datetime: string
  day: string
  calories?: number | null
  distance?: number | null
  intensity?: string | null
  source?: string | null
}
