import type { Database } from '@cico/db'
import { loadToken, saveToken } from '../../lib/oauth-store.js'
import { refreshWithingsToken } from '../../oauth/withings.js'

const BASE = 'https://wbsapi.withings.net'

export class WithingsAuthError extends Error {}
export class WithingsNotConnectedError extends Error {
  constructor() {
    super('withings is not connected')
  }
}

export type WithingsOpts = {
  clientId: string
  clientSecret: string
}

export async function withingsCall<T>(
  db: Database,
  opts: WithingsOpts,
  endpoint: string,
  params: Record<string, string | number | undefined>,
): Promise<T> {
  const token = await getValidAccessToken(db, opts)
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) body.set(k, String(v))
  }
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) {
    if (res.status === 401) throw new WithingsAuthError(`withings ${endpoint} 401`)
    throw new Error(`withings ${endpoint} failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { status: number; body?: T; error?: string }
  if (json.status !== 0) {
    if (json.status === 401) throw new WithingsAuthError(`withings ${endpoint} status=401`)
    throw new Error(`withings ${endpoint} status=${json.status} ${json.error ?? ''}`)
  }
  return json.body as T
}

async function getValidAccessToken(db: Database, opts: WithingsOpts): Promise<string> {
  const tok = await loadToken(db, 'withings')
  if (!tok) throw new WithingsNotConnectedError()
  const expiresSoon = tok.expiresAt && tok.expiresAt.getTime() - Date.now() < 60_000
  if (!expiresSoon) return tok.accessToken
  if (!tok.refreshToken) return tok.accessToken
  const refreshed = await refreshWithingsToken({
    refreshToken: tok.refreshToken,
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
  })
  await saveToken(db, 'withings', {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: refreshed.expiresAt,
    scope: JSON.stringify({ scope: refreshed.scope, userid: refreshed.userid }),
  })
  return refreshed.accessToken
}

export async function getWithingsUserId(db: Database): Promise<string | null> {
  const tok = await loadToken(db, 'withings')
  if (!tok?.scope) return null
  try {
    const parsed = JSON.parse(tok.scope) as { userid?: string }
    return parsed.userid ?? null
  } catch {
    return null
  }
}
