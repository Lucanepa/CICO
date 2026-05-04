import type { Database } from '@cico/db'
import { loadToken, saveToken } from '../../lib/oauth-store.js'
import { refreshOuraToken } from '../../oauth/oura.js'

const BASE = 'https://api.ouraring.com/v2/usercollection'

export class OuraAuthError extends Error {}
export class OuraNotConnectedError extends Error {
  constructor() {
    super('oura is not connected')
  }
}

export type OuraOpts = {
  clientId: string
  clientSecret: string
}

export async function ouraFetch<T>(
  db: Database,
  opts: OuraOpts,
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T> {
  const token = await getValidAccessToken(db, opts)
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new OuraAuthError('oura returned 401')
  if (res.status === 429) throw new Error('oura rate limit')
  if (!res.ok) throw new Error(`oura ${path} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

async function getValidAccessToken(db: Database, opts: OuraOpts): Promise<string> {
  const tok = await loadToken(db, 'oura')
  if (!tok) throw new OuraNotConnectedError()
  const expiresSoon = tok.expiresAt && tok.expiresAt.getTime() - Date.now() < 60_000
  if (!expiresSoon) return tok.accessToken
  if (!tok.refreshToken) return tok.accessToken
  const refreshed = await refreshOuraToken({
    refreshToken: tok.refreshToken,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
  })
  await saveToken(db, 'oura', refreshed)
  return refreshed.accessToken
}

export type OuraPaged<T> = { data: T[]; next_token: string | null }

export async function* ouraPaginate<T>(
  db: Database,
  opts: OuraOpts,
  path: string,
  query: Record<string, string | number | undefined> = {},
): AsyncGenerator<T> {
  let nextToken: string | null = null
  do {
    const page: OuraPaged<T> = await ouraFetch(db, opts, path, {
      ...query,
      next_token: nextToken ?? undefined,
    })
    for (const item of page.data) yield item
    nextToken = page.next_token
  } while (nextToken)
}
