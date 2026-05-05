import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { db } from '../lib/db.js'
import { saveToken } from '../lib/oauth-store.js'
import type { Env } from '../lib/env.js'

const AUTH_URL = 'https://www.strava.com/oauth/authorize'
const TOKEN_URL = 'https://www.strava.com/oauth/token'
const SCOPES = 'read,activity:read_all'

export function stravaOauth(env: Env, getEnv: (k: string) => string | undefined) {
  const app = new Hono()

  app.get('/start', (c) => {
    const clientId = getEnv('STRAVA_CLIENT_ID')
    const redirectUri = getEnv('STRAVA_REDIRECT_URI')
    if (!clientId || !redirectUri) return c.json({ error: 'strava_not_configured' }, 500)

    const state = crypto.randomUUID()
    const isProd = env.NODE_ENV === 'production'
    setCookie(c, 'strava_oauth_state', state, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'None' : 'Lax',
      maxAge: 600,
      path: '/',
    })

    const url = new URL(AUTH_URL)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('approval_prompt', 'auto')
    url.searchParams.set('scope', SCOPES)
    url.searchParams.set('state', state)
    return c.redirect(url.toString())
  })

  app.get('/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const cookieState = getCookie(c, 'strava_oauth_state')
    deleteCookie(c, 'strava_oauth_state', { path: '/' })

    if (!code) return c.json({ error: 'missing_code' }, 400)
    if (!state || state !== cookieState) return c.json({ error: 'state_mismatch' }, 400)

    const clientId = getEnv('STRAVA_CLIENT_ID')
    const clientSecret = getEnv('STRAVA_CLIENT_SECRET')
    if (!clientId || !clientSecret) return c.json({ error: 'strava_not_configured' }, 500)

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    })
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) {
      const text = await res.text()
      return c.json({ error: 'token_exchange_failed', detail: text }, 502)
    }
    const json = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_at: number
      scope?: string
    }
    await saveToken(db(env.DATABASE_URL), 'strava', {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(json.expires_at * 1000),
      scope: json.scope ?? SCOPES,
    })
    return c.redirect(`${env.WEB_BASE_URL ?? ''}/?connected=strava`)
  })

  return app
}

export async function refreshStravaToken(opts: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope: string | null
}> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`strava refresh failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_at: number
    scope?: string
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(json.expires_at * 1000),
    scope: json.scope ?? null,
  }
}
