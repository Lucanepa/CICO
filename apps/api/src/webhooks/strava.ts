import * as Sentry from '@sentry/node'
import { Hono } from 'hono'
import type { Env } from '../lib/env.js'
import { db } from '../lib/db.js'
import { loadHrSettings } from '../lib/hr-settings.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { ingestStravaActivityById } from '../sync/strava/index.js'

type WebhookEvent = {
  object_type: 'activity' | 'athlete'
  object_id: number
  aspect_type: 'create' | 'update' | 'delete'
  owner_id: number
  subscription_id: number
  event_time: number
  updates?: Record<string, string>
}

export function stravaWebhook(env: Env) {
  const app = new Hono()

  app.get('/', (c) => {
    const mode = c.req.query('hub.mode')
    const challenge = c.req.query('hub.challenge')
    const verify = c.req.query('hub.verify_token')
    const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
    if (mode === 'subscribe' && verify && verify === expected && challenge) {
      return c.json({ 'hub.challenge': challenge })
    }
    return c.json({ error: 'verification_failed' }, 403)
  })

  app.post('/', async (c) => {
    let event: WebhookEvent
    try {
      event = (await c.req.json()) as WebhookEvent
    } catch {
      return c.json({ error: 'invalid_json' }, 400)
    }

    void handleEvent(env, event).catch((e) => Sentry.captureException(e))
    return c.json({ ok: true })
  })

  return app
}

async function handleEvent(env: Env, event: WebhookEvent) {
  if (event.object_type !== 'activity') return
  if (event.aspect_type === 'delete') {
    return
  }
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) return

  const database = db(env.DATABASE_URL)
  const userId = await getOrCreateDefaultUser(database, env.DEFAULT_USER_EMAIL)
  const hr = await loadHrSettings(database, userId)

  await ingestStravaActivityById(
    database,
    { clientId: env.STRAVA_CLIENT_ID, clientSecret: env.STRAVA_CLIENT_SECRET },
    userId,
    event.object_id,
    hr,
  )
}

