const TOKEN_KEY = 'cico.access_token'
const REFRESH_KEY = 'cico.refresh_token'
const EXPIRES_KEY = 'cico.expires_at'

export type DirectusSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

const DIRECTUS_URL = (import.meta.env.VITE_DIRECTUS_URL ?? '').trim().replace(/\/$/, '')

function persist(s: DirectusSession): void {
  localStorage.setItem(TOKEN_KEY, s.accessToken)
  localStorage.setItem(REFRESH_KEY, s.refreshToken)
  localStorage.setItem(EXPIRES_KEY, String(s.expiresAt))
}

export function readSession(): DirectusSession | null {
  const accessToken = localStorage.getItem(TOKEN_KEY)
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) ?? 0)
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken, expiresAt }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(EXPIRES_KEY)
}

function sessionFromResponse(data: { access_token: string; refresh_token: string; expires: number }): DirectusSession {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires,
  }
}

export async function login(email: string, password: string): Promise<DirectusSession> {
  if (!DIRECTUS_URL) throw new Error('VITE_DIRECTUS_URL not configured')
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, mode: 'json' }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `login failed (${res.status})`)
  }
  const body = (await res.json()) as { data: { access_token: string; refresh_token: string; expires: number } }
  const session = sessionFromResponse(body.data)
  persist(session)
  return session
}

export async function refresh(): Promise<DirectusSession | null> {
  if (!DIRECTUS_URL) return null
  const current = readSession()
  if (!current) return null
  const res = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: current.refreshToken, mode: 'json' }),
  })
  if (!res.ok) {
    clearSession()
    return null
  }
  const body = (await res.json()) as { data: { access_token: string; refresh_token: string; expires: number } }
  const session = sessionFromResponse(body.data)
  persist(session)
  return session
}

export async function logout(): Promise<void> {
  const current = readSession()
  if (current && DIRECTUS_URL) {
    await fetch(`${DIRECTUS_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refreshToken, mode: 'json' }),
    }).catch(() => undefined)
  }
  clearSession()
}

export async function getValidAccessToken(): Promise<string | null> {
  const current = readSession()
  if (!current) return null
  const skewMs = 15_000
  if (current.expiresAt - skewMs > Date.now()) return current.accessToken
  const fresh = await refresh()
  return fresh?.accessToken ?? null
}

export const authConfigured = Boolean(DIRECTUS_URL)
