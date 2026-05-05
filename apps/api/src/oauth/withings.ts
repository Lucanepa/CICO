import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { db } from '../lib/db.js'
import { saveToken } from '../lib/oauth-store.js'
import type { Env } from '../lib/env.js'

const AUTH_URL = 'https://account.withings.com/oauth2_user/authorize2'
const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2'
const SCOPES = ['user.metrics']

type WithingsTokenBody = {
  userid: string | number
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  token_type: string
}

type WithingsTokenEnvelope = {
  status: number
  body?: WithingsTokenBody
  error?: string
}

export function withingsOauth(env: Env, getEnv: (k: string) => string | undefined) {
  const app = new Hono()

  app.get('/start', (c) => {
    const clientId = getEnv('WITHINGS_CLIENT_ID')
    const redirectUri = getEnv('WITHINGS_REDIRECT_URI')
    if (!clientId || !redirectUri) return c.json({ error: 'withings_not_configured' }, 500)

    const state = crypto.randomUUID()
    const isProd = env.NODE_ENV === 'production'
    setCookie(c, 'withings_oauth_state', state, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'None' : 'Lax',
      maxAge: 600,
      path: '/',
    })

    const url = new URL(AUTH_URL)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', SCOPES.join(','))
    url.searchParams.set('state', state)
    return c.redirect(url.toString())
  })

  app.get('/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')

    // Withings does a pre-flight reachability probe with no query params —
    // answer 200 for that so the partner check passes; real OAuth callbacks
    // always carry ?code= and ?state=.
    if (!code && !state) return c.body(null, 200)

    const cookieState = getCookie(c, 'withings_oauth_state')
    deleteCookie(c, 'withings_oauth_state', { path: '/' })

    if (!code) return c.json({ error: 'missing_code' }, 400)
    if (!state || state !== cookieState) return c.json({ error: 'state_mismatch' }, 400)

    const clientId = getEnv('WITHINGS_CLIENT_ID')
    const clientSecret = getEnv('WITHINGS_CLIENT_SECRET')
    const redirectUri = getEnv('WITHINGS_REDIRECT_URI')
    if (!clientId || !clientSecret || !redirectUri) {
      return c.json({ error: 'withings_not_configured' }, 500)
    }

    const tok = await exchangeCode({ code, clientId, clientSecret, redirectUri })
    await saveToken(db(env.DATABASE_URL), 'withings', {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: new Date(Date.now() + tok.expires_in * 1000),
      scope: JSON.stringify({ scope: tok.scope, userid: String(tok.userid) }),
    })
    return c.redirect(`${env.WEB_BASE_URL ?? ''}/?connected=withings`)
  })

  return app
}

async function exchangeCode(opts: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<WithingsTokenBody> {
  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'authorization_code',
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    code: opts.code,
    redirect_uri: opts.redirectUri,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const env = (await res.json()) as WithingsTokenEnvelope
  if (env.status !== 0 || !env.body) {
    throw new Error(`withings token exchange failed: ${env.status} ${env.error ?? ''}`)
  }
  return env.body
}

export async function refreshWithingsToken(opts: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; scope: string; userid: string }> {
  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'refresh_token',
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    refresh_token: opts.refreshToken,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const env = (await res.json()) as WithingsTokenEnvelope
  if (env.status !== 0 || !env.body) {
    throw new Error(`withings refresh failed: ${env.status} ${env.error ?? ''}`)
  }
  return {
    accessToken: env.body.access_token,
    refreshToken: env.body.refresh_token,
    expiresAt: new Date(Date.now() + env.body.expires_in * 1000),
    scope: env.body.scope,
    userid: String(env.body.userid),
  }
}
