import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { db } from '../lib/db.js'
import { saveToken } from '../lib/oauth-store.js'
import type { Env } from '../lib/env.js'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly'

export function googleOauth(env: Env, getEnv: (k: string) => string | undefined) {
  const app = new Hono()

  app.get('/start', (c) => {
    const clientId = getEnv('GOOGLE_CLIENT_ID')
    const redirectUri = getEnv('GOOGLE_REDIRECT_URI')
    if (!clientId || !redirectUri) return c.json({ error: 'google_not_configured' }, 500)

    const state = crypto.randomUUID()
    setCookie(c, 'google_oauth_state', state, {
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
    url.searchParams.set('scope', SCOPE)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('state', state)
    return c.redirect(url.toString())
  })

  app.get('/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const cookieState = getCookie(c, 'google_oauth_state')
    deleteCookie(c, 'google_oauth_state', { path: '/' })

    if (!code) return c.json({ error: 'missing_code' }, 400)
    if (!state || state !== cookieState) return c.json({ error: 'state_mismatch' }, 400)

    const clientId = getEnv('GOOGLE_CLIENT_ID')
    const clientSecret = getEnv('GOOGLE_CLIENT_SECRET')
    const redirectUri = getEnv('GOOGLE_REDIRECT_URI')
    if (!clientId || !clientSecret || !redirectUri) {
      return c.json({ error: 'google_not_configured' }, 500)
    }

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
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
      refresh_token?: string
      expires_in?: number
      scope?: string
    }
    await saveToken(db(env.DATABASE_URL), 'google', {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
      scope: json.scope ?? SCOPE,
    })
    return c.redirect('/?connected=google')
  })

  return app
}

export async function refreshGoogleToken(opts: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date | null
  scope: string | null
}> {
  const body = new URLSearchParams({
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    grant_type: 'refresh_token',
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`google refresh failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {
    access_token: string
    expires_in?: number
    scope?: string
  }
  return {
    accessToken: json.access_token,
    refreshToken: opts.refreshToken,
    expiresAt: json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null,
    scope: json.scope ?? null,
  }
}
