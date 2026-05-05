import { and, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { schema } from '@cico/db'
import { getRequestEmail } from '../lib/auth.js'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { getOrCreateDefaultUser } from '../lib/user.js'

export function fitnessRoute(env: Env) {
  const app = new Hono()

  app.get('/today', async (c) => {
    const dateParam = c.req.query('date')
    const date = dateParam ?? localIsoDate(env.TZ)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'invalid_date' }, 400)

    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))

    const dailies = await database
      .select({
        source: schema.dailyTotals.source,
        steps: schema.dailyTotals.steps,
        restingHr: schema.dailyTotals.restingHr,
        activeCalories: schema.dailyTotals.activeCalories,
      })
      .from(schema.dailyTotals)
      .where(and(eq(schema.dailyTotals.userId, userId), eq(schema.dailyTotals.date, date)))

    const huawei = dailies.find((d) => d.source === 'huawei')
    const oura = dailies.find((d) => d.source === 'oura')
    const steps = huawei?.steps ?? oura?.steps ?? null
    const restingHr = huawei?.restingHr ?? oura?.restingHr ?? null
    const activeCalories = huawei?.activeCalories ?? oura?.activeCalories ?? null

    const sleep = await database
      .select({
        date: schema.sleepSessions.date,
        score: schema.sleepSessions.score,
        totalMin: schema.sleepSessions.totalMin,
        deepMin: schema.sleepSessions.deepMin,
        remMin: schema.sleepSessions.remMin,
        hrvAvg: schema.sleepSessions.hrvAvg,
        source: schema.sleepSessions.source,
      })
      .from(schema.sleepSessions)
      .where(eq(schema.sleepSessions.userId, userId))
      .orderBy(desc(schema.sleepSessions.date))
      .limit(1)
    const lastSleep = sleep[0] ?? null

    return c.json({
      ok: true,
      fitness: {
        date,
        steps,
        restingHr,
        activeCalories,
        sleep: lastSleep
          ? {
              date: lastSleep.date,
              score: lastSleep.score,
              totalMin: lastSleep.totalMin,
              deepMin: lastSleep.deepMin,
              remMin: lastSleep.remMin,
              hrvAvg: lastSleep.hrvAvg,
              source: lastSleep.source,
            }
          : null,
      },
    })
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
