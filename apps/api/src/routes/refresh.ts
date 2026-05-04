import { Hono } from 'hono'
import * as Sentry from '@sentry/node'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { loadHrSettings } from '../lib/hr-settings.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { OuraNotConnectedError } from '../sync/oura/client.js'
import { syncOura } from '../sync/oura/index.js'
import { StravaNotConnectedError } from '../sync/strava/client.js'
import { syncStrava } from '../sync/strava/index.js'
import { GoogleNotConnectedError, syncHealthSync } from '../sync/healthsync/index.js'
import { dedupWorkoutsForWindow } from '../dedup/index.js'

export function refreshRoute(env: Env) {
  const app = new Hono()

  app.get('/', async (c) => {
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, env.DEFAULT_USER_EMAIL)
    const hr = await loadHrSettings(database, userId)

    const sources: Record<string, unknown> = {}

    if (env.OURA_CLIENT_ID && env.OURA_CLIENT_SECRET) {
      try {
        sources.oura = await syncOura(
          database,
          { clientId: env.OURA_CLIENT_ID, clientSecret: env.OURA_CLIENT_SECRET },
          userId,
        )
      } catch (err) {
        if (err instanceof OuraNotConnectedError) {
          sources.oura = { status: 'not_connected' }
        } else {
          Sentry.captureException(err)
          sources.oura = { status: 'error', message: (err as Error).message }
        }
      }
    } else {
      sources.oura = { status: 'not_configured' }
    }

    if (env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET) {
      try {
        sources.strava = await syncStrava(
          database,
          { clientId: env.STRAVA_CLIENT_ID, clientSecret: env.STRAVA_CLIENT_SECRET },
          userId,
          hr,
        )
      } catch (err) {
        if (err instanceof StravaNotConnectedError) {
          sources.strava = { status: 'not_connected' }
        } else {
          Sentry.captureException(err)
          sources.strava = { status: 'error', message: (err as Error).message }
        }
      }
    } else {
      sources.strava = { status: 'not_configured' }
    }

    if (
      env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_DRIVE_FOLDER_ID
    ) {
      try {
        sources.huawei = await syncHealthSync(
          database,
          { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
          userId,
          env.GOOGLE_DRIVE_FOLDER_ID,
        )
      } catch (err) {
        if (err instanceof GoogleNotConnectedError) {
          sources.huawei = { status: 'not_connected' }
        } else {
          Sentry.captureException(err)
          sources.huawei = { status: 'error', message: (err as Error).message }
        }
      }
    } else {
      sources.huawei = { status: 'not_configured' }
    }

    const today = new Date()
    const startDate = isoDate(daysAgo(today, 14))
    const endDate = isoDate(today)
    try {
      const dedup = await dedupWorkoutsForWindow(database, userId, startDate, endDate)
      sources.dedup = dedup
    } catch (err) {
      Sentry.captureException(err)
      sources.dedup = { status: 'error', message: (err as Error).message }
    }

    return c.json({ ok: true, userId, sources })
  })

  return app
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(from: Date, n: number): Date {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}
