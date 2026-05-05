import type { Context, MiddlewareHandler } from 'hono'
import type { Env } from './env.js'

export type AuthUser = {
  id: string
  email: string
  role: string | null
}

declare module 'hono' {
  interface ContextVariableMap {
    userEmail: string
    directusUser: AuthUser
  }
}

type Cached = { user: AuthUser; expiresAt: number }
const cache = new Map<string, Cached>()
const TTL_MS = 60_000

async function verifyToken(directusUrl: string, token: string): Promise<AuthUser | null> {
  const cached = cache.get(token)
  if (cached && cached.expiresAt > Date.now()) return cached.user

  const res = await fetch(`${directusUrl.replace(/\/$/, '')}/users/me?fields=id,email,role`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null

  const body = (await res.json()) as { data?: { id: string; email: string; role: string | null } }
  if (!body.data?.email) return null
  const user: AuthUser = { id: body.data.id, email: body.data.email, role: body.data.role }
  cache.set(token, { user, expiresAt: Date.now() + TTL_MS })
  return user
}

function extractBearer(c: Context): string | null {
  const header = c.req.header('authorization') ?? ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  const token = m?.[1]?.trim()
  return token ? token : null
}

const SKIP_PREFIXES = ['/api/health', '/api/oauth/', '/api/webhooks/']

export function requireDirectusAuth(env: Env): MiddlewareHandler {
  return async (c, next) => {
    if (!env.DIRECTUS_URL) return next()

    const path = c.req.path
    if (SKIP_PREFIXES.some((p) => path === p || path.startsWith(p))) return next()
    if (c.req.method === 'OPTIONS') return next()

    const token = extractBearer(c)
    if (!token) return c.json({ error: 'unauthenticated' }, 401)

    const user = await verifyToken(env.DIRECTUS_URL, token)
    if (!user) return c.json({ error: 'unauthenticated' }, 401)
    if (env.DIRECTUS_REQUIRED_ROLE && user.role !== env.DIRECTUS_REQUIRED_ROLE) {
      return c.json({ error: 'forbidden' }, 403)
    }

    c.set('userEmail', user.email)
    c.set('directusUser', user)
    return next()
  }
}

export function getRequestEmail(c: Context, env: Env): string {
  const fromAuth = c.get('userEmail') as string | undefined
  if (fromAuth) return fromAuth
  if (env.DIRECTUS_URL) throw new Error('no authenticated user on protected request')
  return env.DEFAULT_USER_EMAIL
}
