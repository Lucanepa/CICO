import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { db } from '../lib/db.js'
import { saveToken } from '../lib/oauth-store.js'
import type { Env } from '../lib/env.js'

const AUTH_URL = 'https://cloud.ouraring.com/oauth/authorize'
const TOKEN_URL = 'https://api.ouraring.com/oauth/token'
const SCOPES = ['daily', 'workout', 'heartrate', 'session', 'personal']

export function ouraOauth(env: Env, getEnv: (k: string) => string | undefined) {
  const app = new Hono()

  app.get('/start', (c) => {
    const clientId = getEnv('OURA_CLIENT_ID')
    const redirectUri = getEnv('OURA_REDIRECT_URI')
    if (!clientId || !redirectUri) return c.json({ error: 'oura_not_configured' }, 500)

    const state = crypto.randomUUID()
    setCookie(c, 'oura_oauth_state', state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 600,
      path: '/',
    })

    const url = new URL(AUTH_URL)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', SCOPES.join(' '))
    url.searchParams.set('state', state)
    return c.redirect(url.toString())
  })

  app.get('/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const cookieState = getCookie(c, 'oura_oauth_state')
    deleteCookie(c, 'oura_oauth_state', { path: '/' })

    if (!code) return c.json({ error: 'missing_code' }, 400)
    if (!state || state !== cookieState) return c.json({ error: 'state_mismatch' }, 400)

    const clientId = getEnv('OURA_CLIENT_ID')
    const clientSecret = getEnv('OURA_CLIENT_SECRET')
    const redirectUri = getEnv('OURA_REDIRECT_URI')
    if (!clientId || !clientSecret || !redirectUri) {
      return c.json({ error: 'oura_not_configured' }, 500)
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
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
      refresh_token?: string
      expires_in?: number
      scope?: string
    }
    const expiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null
    await saveToken(db(env.DATABASE_URL), 'oura', {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt,
      scope: json.scope ?? null,
    })
    return c.redirect('/?connected=oura')
  })

  return app
}

export async function refreshOuraToken(opts: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date | null; scope: string | null }> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`oura refresh failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in?: number
    scope?: string
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scope: json.scope ?? null,
  }
}
