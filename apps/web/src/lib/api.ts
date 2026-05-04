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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin' })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return (await res.json()) as T
}

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return (await res.json()) as T
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
