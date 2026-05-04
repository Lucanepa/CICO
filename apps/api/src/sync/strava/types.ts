export type StravaActivity = {
  id: number
  external_id?: string | null
  name: string
  type: string
  sport_type?: string
  start_date: string
  start_date_local: string
  elapsed_time: number
  moving_time: number
  distance: number
  calories?: number | null
  average_heartrate?: number | null
  max_heartrate?: number | null
  has_heartrate?: boolean
  device_name?: string | null
}

export type StravaActivityZones = Array<{
  type: 'heartrate' | 'power'
  distribution_buckets: Array<{ min: number; max: number; time: number }>
}>
