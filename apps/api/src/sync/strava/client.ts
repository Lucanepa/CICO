import type { Database } from '@cico/db'
import { loadToken, saveToken } from '../../lib/oauth-store.js'
import { refreshStravaToken } from '../../oauth/strava.js'
import type { StravaActivity, StravaActivityZones } from './types.js'

const BASE = 'https://www.strava.com/api/v3'

export class StravaAuthError extends Error {}
export class StravaNotConnectedError extends Error {
  constructor() {
    super('strava is not connected')
  }
}

export type StravaOpts = {
  clientId: string
  clientSecret: string
}

async function getValidAccessToken(db: Database, opts: StravaOpts): Promise<string> {
  const tok = await loadToken(db, 'strava')
  if (!tok) throw new StravaNotConnectedError()
  const expiresSoon = tok.expiresAt && tok.expiresAt.getTime() - Date.now() < 60_000
  if (!expiresSoon) return tok.accessToken
  if (!tok.refreshToken) return tok.accessToken
  const refreshed = await refreshStravaToken({
    refreshToken: tok.refreshToken,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
  })
  await saveToken(db, 'strava', refreshed)
  return refreshed.accessToken
}

async function stravaFetch<T>(
  db: Database,
  opts: StravaOpts,
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T> {
  const token = await getValidAccessToken(db, opts)
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (res.status === 401) throw new StravaAuthError('strava 401')
  if (res.status === 429) throw new Error('strava rate limit')
  if (!res.ok) throw new Error(`strava ${path} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

export async function* stravaListActivities(
  db: Database,
  opts: StravaOpts,
  after?: Date,
): AsyncGenerator<StravaActivity> {
  const perPage = 100
  let page = 1
  while (true) {
    const items = await stravaFetch<StravaActivity[]>(db, opts, '/athlete/activities', {
      after: after ? Math.floor(after.getTime() / 1000) : undefined,
      per_page: perPage,
      page,
    })
    for (const a of items) yield a
    if (items.length < perPage) return
    page++
  }
}

export function getActivity(db: Database, opts: StravaOpts, id: number): Promise<StravaActivity> {
  return stravaFetch<StravaActivity>(db, opts, `/activities/${id}`)
}

export function getActivityZones(
  db: Database,
  opts: StravaOpts,
  id: number,
): Promise<StravaActivityZones> {
  return stravaFetch<StravaActivityZones>(db, opts, `/activities/${id}/zones`)
}
