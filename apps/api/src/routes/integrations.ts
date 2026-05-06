import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { schema } from '@cico/db'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'

type IntegrationStatus = {
  source: 'oura' | 'strava' | 'google' | 'withings'
  label: string
  description: string
  configured: boolean
  connected: boolean
  expiresAt: string | null
  startUrl: string
  lastSyncedAt: string | null
  lastRunStatus: string | null
  lastError: string | null
}

const SOURCES = [
  {
    source: 'oura' as const,
    label: 'Oura',
    description: 'Sleep, readiness, daily activity, workouts.',
    envKeys: ['OURA_CLIENT_ID', 'OURA_CLIENT_SECRET'],
  },
  {
    source: 'strava' as const,
    label: 'Strava',
    description: 'Workouts and zones.',
    envKeys: ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET'],
  },
  {
    source: 'google' as const,
    label: 'Google Drive',
    description: 'Health Sync CSVs (Huawei + Omron).',
    // FOLDER_ID is optional now: empty means "scan whole Drive by filename pattern".
    envKeys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  {
    source: 'withings' as const,
    label: 'Withings',
    description: 'Body Scan — weight, body comp, BP, ECG.',
    envKeys: ['WITHINGS_CLIENT_ID', 'WITHINGS_CLIENT_SECRET'],
  },
]

export function integrationsRoute(env: Env) {
  const app = new Hono()

  app.get('/status', async (c) => {
    const database = db(env.DATABASE_URL)
    const [tokens, syncRows] = await Promise.all([
      database
        .select({
          source: schema.oauthTokens.source,
          expiresAt: schema.oauthTokens.expiresAt,
        })
        .from(schema.oauthTokens),
      database
        .select({
          source: schema.syncState.source,
          lastSyncedAt: schema.syncState.lastSyncedAt,
          lastRunStatus: schema.syncState.lastRunStatus,
          lastError: schema.syncState.lastError,
        })
        .from(schema.syncState),
    ])
    const tokenBySource = new Map(tokens.map((t) => [t.source, t]))
    const syncBySource = new Map(syncRows.map((s) => [s.source, s]))

    const apiBase = absoluteApiBase(c.req.url)
    const out: IntegrationStatus[] = SOURCES.map((s) => {
      const tok = tokenBySource.get(s.source)
      const sync = syncBySource.get(s.source)
      const configured = s.envKeys.every((k) => Boolean(process.env[k]))
      return {
        source: s.source,
        label: s.label,
        description: s.description,
        configured,
        connected: Boolean(tok),
        expiresAt: tok?.expiresAt ? tok.expiresAt.toISOString() : null,
        startUrl: `${apiBase}/api/oauth/${s.source}/start`,
        lastSyncedAt: sync?.lastSyncedAt ? sync.lastSyncedAt.toISOString() : null,
        lastRunStatus: sync?.lastRunStatus ?? null,
        lastError: sync?.lastError ?? null,
      }
    })
    return c.json({ ok: true, integrations: out })
  })

  app.post('/disconnect/:source', async (c) => {
    const source = c.req.param('source')
    if (!SOURCES.some((s) => s.source === source)) {
      return c.json({ error: 'unknown_source' }, 400)
    }
    const database = db(env.DATABASE_URL)
    await database.delete(schema.oauthTokens).where(eq(schema.oauthTokens.source, source))
    return c.json({ ok: true })
  })

  return app
}

function absoluteApiBase(reqUrl: string): string {
  try {
    const u = new URL(reqUrl)
    return `${u.protocol}//${u.host}`
  } catch {
    return ''
  }
}
