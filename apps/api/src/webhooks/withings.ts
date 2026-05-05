import * as Sentry from '@sentry/node'
import { Hono } from 'hono'
import type { Env } from '../lib/env.js'
import { db } from '../lib/db.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { syncWithings } from '../sync/withings/index.js'

// Withings notification (form-encoded POST)
//   userid     — Withings user id
//   startdate  — epoch seconds
//   enddate    — epoch seconds
//   appli      — notification type (1 = new weight measure)
type Notification = {
  userid: string
  startdate: number
  enddate: number
  appli: number
}

export function withingsWebhook(env: Env) {
  const app = new Hono()

  // Withings calls HEAD (and sometimes GET) for callback verification — must respond 2xx.
  app.on(['HEAD', 'GET'], '/', (c) => c.body(null, 200))

  app.post('/', async (c) => {
    const form = await c.req.formData().catch(() => null)
    if (!form) return c.json({ ok: true })

    const note: Notification = {
      userid: String(form.get('userid') ?? ''),
      startdate: Number(form.get('startdate') ?? 0),
      enddate: Number(form.get('enddate') ?? 0),
      appli: Number(form.get('appli') ?? 0),
    }

    void handleNotification(env, note).catch((e) => Sentry.captureException(e))
    return c.body(null, 200)
  })

  return app
}

async function handleNotification(env: Env, note: Notification): Promise<void> {
  if (!env.WITHINGS_CLIENT_ID || !env.WITHINGS_CLIENT_SECRET) return
  if (!note.appli) return

  const windowStart = note.startdate
    ? new Date(note.startdate * 1000)
    : new Date(Date.now() - 60 * 60 * 1000)

  const database = db(env.DATABASE_URL)
  const userId = await getOrCreateDefaultUser(database, env.DEFAULT_USER_EMAIL)
  await syncWithings(
    database,
    { clientId: env.WITHINGS_CLIENT_ID, clientSecret: env.WITHINGS_CLIENT_SECRET },
    userId,
    windowStart,
  )
}
