// Withings measure type IDs we ingest
export const WITHINGS_MEASURE_TYPES = {
  weight: 1,
  fatFreeMass: 5,
  fatRatio: 6,
  fatMass: 8,
  diastolicBp: 9,
  systolicBp: 10,
  heartPulse: 11,
  spo2: 54,
  muscleMass: 76,
  hydration: 77,
  boneMass: 88,
  pwv: 91,
  vascularAge: 155,
  nerveHealth: 167,
  extracellularWater: 168,
  intracellularWater: 169,
  visceralFat: 226,
} as const

export const ALL_MEAS_TYPES = Object.values(WITHINGS_MEASURE_TYPES).join(',')

// /heart?action=list response item
export type WithingsEcgSession = {
  ecg: {
    signalid?: number
    afib?: number
    afib_classification?: number
  }
  bloodpressure?: {
    diastole?: number
    systole?: number
  }
  heart_rate?: number
  timestamp: number
  modified?: number
  model?: number
  qrs?: number
  pr?: number
  qt?: number
  qtc?: number
  duration?: number
  sampling_frequency?: number
  device_model?: string
  signal_url?: string
}

export type WithingsHeartListResponse = {
  status: number
  body?: {
    series: WithingsEcgSession[]
    more?: number
    offset?: number
  }
  error?: string
}

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
