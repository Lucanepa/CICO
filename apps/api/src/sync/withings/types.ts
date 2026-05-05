// Withings measure type IDs we ingest
export const WITHINGS_MEASURE_TYPES = {
  weight: 1,
  fatFreeMass: 5,
  fatRatio: 6,
  fatMass: 8,
  heartPulse: 11,
  muscleMass: 76,
  hydration: 77,
  boneMass: 88,
  pwv: 91,
  visceralFat: 226,
} as const

export const ALL_MEAS_TYPES = Object.values(WITHINGS_MEASURE_TYPES).join(',')

export type WithingsMeasure = {
  value: number
  type: number
  unit: number
  algo?: number
  fm?: number
  fw?: number
}

export type WithingsMeasureGroup = {
  grpid: number
  attrib: number
  date: number
  created: number
  modified: number
  category: number
  deviceid?: string
  hash_deviceid?: string
  measures: WithingsMeasure[]
  comment?: string | null
  timezone?: string
}

export type WithingsMeasureResponse = {
  status: number
  body?: {
    updatetime: number
    timezone: string
    measuregrps: WithingsMeasureGroup[]
    more?: number
    offset?: number
  }
  error?: string
}
