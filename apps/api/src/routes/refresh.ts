import { Hono } from 'hono'
import * as Sentry from '@sentry/node'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { syncOura } from '../sync/oura/index.js'
import { OuraNotConnectedError } from '../sync/oura/client.js'

export function refreshRoute(env: Env) {
  const app = new Hono()

  app.get('/', async (c) => {
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, env.DEFAULT_USER_EMAIL)

    const result: Record<string, unknown> = {}

    if (env.OURA_CLIENT_ID && env.OURA_CLIENT_SECRET) {
      try {
        result.oura = await syncOura(database, {
          clientId: env.OURA_CLIENT_ID,
          clientSecret: env.OURA_CLIENT_SECRET,
        }, userId)
      } catch (err) {
        if (err instanceof OuraNotConnectedError) {
          result.oura = { status: 'not_connected' }
        } else {
          Sentry.captureException(err)
          result.oura = { status: 'error', message: (err as Error).message }
        }
      }
    } else {
      result.oura = { status: 'not_configured' }
    }

    return c.json({ ok: true, userId, sources: result })
  })

  return app
}
