import { Hono } from 'hono'
import { getRequestEmail } from '../lib/auth.js'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { loadAndComputeDay } from '../cico/load.js'

export function todayRoute(env: Env) {
  const app = new Hono()

  app.get('/', async (c) => {
    const dateParam = c.req.query('date')
    const date = dateParam ?? localIsoDate(env.TZ)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'invalid_date' }, 400)

    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))
    const breakdown = await loadAndComputeDay(database, userId, date)
    return c.json({ ok: true, userId, breakdown })
  })

  return app
}

function localIsoDate(tz: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}
