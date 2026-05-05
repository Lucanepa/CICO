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
  flags: string[]
}

export type ZoneMinutes = {
  z0: number
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
}

export type Workout = {
  id: string
  date: string
  startTime: string
  endTime: string
  source: string
  sourceId: string | null
  type: string
  durationMin: number
  calories: number | null
  avgHr: number | null
  maxHr: number | null
  zoneMinutesJsonb: ZoneMinutes | null
  isPrimary: boolean
  duplicateOf: string | null
}

export type SearchHit = {
  id: string
  table: 'foods' | 'custom_foods'
  source: string
  name: string
  kcal100g: number
  p100g: number | null
  c100g: number | null
  f100g: number | null
  defaultServingG: number | null
  barcode?: string | null
}

export type OcrResult = {
  name: string
  kcal_100g: number
  protein_100g: number | null
  carbs_100g: number | null
  fat_100g: number | null
  fiber_100g: number | null
  default_serving_g: number | null
  barcode: string | null
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

export type RecipeImport = {
  name: string
  kcal100g: number | null
  p100g: number | null
  c100g: number | null
  f100g: number | null
  fiber100g: number | null
  defaultServingG: number | null
  servings: number | null
  totalKcal: number | null
  url: string
  source: 'jsonld'
}

export type TrendDay = {
  date: string
  intake: number
  burn: number
  net: number
  sleepScore: number | null
  z2plusMinutes: number
  weightKg: number | null
}

export type FoodLogEntry = {
  id: string
  date: string
  time: string | null
  foodId: string
  foodTable: 'foods' | 'custom_foods'
  quantityG: number
  kcal: number
  p: number | null
  c: number | null
  f: number | null
  sourceLabel: string | null
}

import { clearSession, getValidAccessToken } from './auth'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '')

function url(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken()
  return token ? { authorization: `Bearer ${token}` } : {}
}

async function handleResponse<T>(path: string, res: Response): Promise<T> {
  if (res.status === 401) {
    clearSession()
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login')
    }
  }
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return (await res.json()) as T
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(url(path), {
    credentials: 'include',
    headers: await authHeaders(),
  })
  return handleResponse<T>(path, res)
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeaders()) }
  if (body) headers['content-type'] = 'application/json'
  const res = await fetch(url(path), {
    method,
    credentials: 'include',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(path, res)
}

export const api = {
  today: (date?: string) =>
    get<{ ok: boolean; breakdown: CicoBreakdown }>(
      `/api/today${date ? `?date=${date}` : ''}`,
    ),
  refresh: () => get<{ ok: boolean; sources: Record<string, unknown> }>(`/api/refresh`),
  foodLog: (date: string) =>
    get<{ ok: boolean; entries: FoodLogEntry[] }>(`/api/food-log?date=${date}`),
  deleteFoodLog: (id: string) => send<{ ok: boolean }>(`/api/food-log/${id}`, 'DELETE'),
  workouts: (date: string) =>
    get<{ ok: boolean; workouts: Workout[] }>(`/api/workouts?date=${date}`),
  workout: (id: string) =>
    get<{
      ok: boolean
      workout: Workout
      samples: Array<{ timestamp: string; bpm: number; source: string }>
      duplicates: Workout[]
      maxHr: number
    }>(`/api/workouts/${id}`),
  pinPrimary: (id: string) => send<{ ok: boolean }>(`/api/workouts/pin-primary`, 'POST', { id }),

  searchFoods: (q: string) =>
    get<{ ok: boolean; hits: SearchHit[]; sources: string[] }>(
      `/api/foods/search?q=${encodeURIComponent(q)}`,
    ),
  byBarcode: (code: string) =>
    get<{ ok: boolean; hit: SearchHit | null }>(`/api/foods/barcode/${encodeURIComponent(code)}`),
  ocr: (imageBase64: string, mimeType: string, persist = false) =>
    send<{ ok: boolean; ocr: OcrResult; food?: SearchHit; persisted: boolean }>(
      `/api/foods/ocr`,
      'POST',
      { imageBase64, mimeType, persist },
    ),
  fromUrl: (url: string, persist = false) =>
    send<{ ok: boolean; recipe: RecipeImport; food?: SearchHit; persisted: boolean }>(
      `/api/foods/from-url`,
      'POST',
      { url, persist },
    ),
  addCustomFood: (body: {
    name: string
    kcal100g: number
    p100g?: number | null
    c100g?: number | null
    f100g?: number | null
    fiber100g?: number | null
    defaultServingG?: number | null
  }) => send<{ ok: boolean; food: SearchHit }>(`/api/foods/custom`, 'POST', body),
  trends: (days: number) =>
    get<{ ok: boolean; days: TrendDay[] }>(`/api/trends?days=${days}`),
  addFoodLog: (body: {
    date: string
    time?: string
    foodId: string
    foodTable: 'foods' | 'custom_foods'
    quantityG: number
  }) => send<{ ok: boolean; entry: FoodLogEntry }>(`/api/food-log`, 'POST', body),
  bodyLatest: () =>
    get<{ ok: boolean; measurement: BodyMeasurement | null }>(`/api/body/latest`),
  bodySeries: (days: number) =>
    get<{ ok: boolean; series: BodyMeasurement[] }>(`/api/body/series?days=${days}`),
  bodyLog: (body: {
    date?: string
    time?: string
    weightKg?: number
    fatPct?: number
    muscleMassKg?: number
    skeletalMusclePct?: number
    boneMassKg?: number
    waterPct?: number
    visceralFat?: number
    bmrKcal?: number
    bodyAge?: number
    bmi?: number
    note?: string
  }) => send<{ ok: boolean; id: string | null }>(`/api/body/log`, 'POST', body),
  deleteBodyLog: (id: string) => send<{ ok: boolean }>(`/api/body/log/${id}`, 'DELETE'),
  fitnessToday: (date?: string) =>
    get<{ ok: boolean; fitness: FitnessSnapshot }>(
      `/api/fitness/today${date ? `?date=${date}` : ''}`,
    ),
  energyBalance: (date?: string, days?: number) =>
    get<{ ok: boolean; energyBalance: EnergyBalance | null }>(
      `/api/body/energy-balance${qs({ date, days })}`,
    ),
  integrations: () =>
    get<{ ok: boolean; integrations: Integration[] }>(`/api/integrations/status`),
  disconnectIntegration: (source: string) =>
    send<{ ok: boolean }>(`/api/integrations/disconnect/${source}`, 'POST'),
}

export type Integration = {
  source: 'oura' | 'strava' | 'google' | 'withings'
  label: string
  description: string
  configured: boolean
  connected: boolean
  expiresAt: string | null
  startUrl: string
  lastSyncedAt: string | null
  lastRunStatus: string | null
  lastError: string | null
}

export type EnergyBalance = {
  windowDays: number
  samples: number
  firstWeightKg: number
  lastWeightKg: number
  slopeKgPerDay: number
  slopeKgPerWeek: number
  kcalPerDay: number
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export type FitnessSnapshot = {
  date: string
  steps: number | null
  restingHr: number | null
  activeCalories: number | null
  sleep: {
    date: string
    score: number | null
    totalMin: number | null
    deepMin: number | null
    remMin: number | null
    hrvAvg: number | null
    source: string
  } | null
}

export type BodyMeasurement = {
  id?: string
  date: string
  measuredAt: string | null
  source: string
  weightKg: number | null
  fatPct: number | null
  muscleMassKg?: number | null
  skeletalMusclePct?: number | null
  boneMassKg?: number | null
  waterPct: number | null
  visceralFat: number | null
  bmrKcal?: number | null
  bodyAge?: number | null
  bmi?: number | null
}

export function localIsoDate(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
