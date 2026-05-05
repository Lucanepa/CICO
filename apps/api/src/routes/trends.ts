import { Hono } from 'hono'
import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { schema } from '@cico/db'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { loadAndComputeDay } from '../cico/load.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import type { ZoneMinutes } from '@cico/shared'

export type TrendDay = {
  date: string
  intake: number
  burn: number
  net: number
  sleepScore: number | null
  z2plusMinutes: number
  weightKg: number | null
}

export function trendsRoute(env: Env) {
  const app = new Hono()

  app.get('/', async (c) => {
    const days = Math.min(180, Math.max(1, Number(c.req.query('days') ?? 30)))
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, env.DEFAULT_USER_EMAIL)

    const dates = lastNDates(days)
    const startDate = dates[0]!
    const endDate = dates[dates.length - 1]!

    const sleepRows = await database
      .select({
        date: schema.sleepSessions.date,
        score: schema.sleepSessions.score,
        source: schema.sleepSessions.source,
      })
      .from(schema.sleepSessions)
      .where(
        and(
          eq(schema.sleepSessions.userId, userId),
          gte(schema.sleepSessions.date, startDate),
          lte(schema.sleepSessions.date, endDate),
        ),
      )
      .orderBy(asc(schema.sleepSessions.date))

    const sleepByDate = new Map<string, number>()
    for (const r of sleepRows) {
      if (r.source !== 'oura') continue
      if (r.score == null) continue
      sleepByDate.set(r.date, r.score)
    }

    const workoutRows = await database
      .select({
        date: schema.workouts.date,
        zoneMinutesJsonb: schema.workouts.zoneMinutesJsonb,
        isPrimary: schema.workouts.isPrimary,
      })
      .from(schema.workouts)
      .where(
        and(
          eq(schema.workouts.userId, userId),
          gte(schema.workouts.date, startDate),
          lte(schema.workouts.date, endDate),
        ),
      )

    const z2ByDate = new Map<string, number>()
    for (const r of workoutRows) {
      if (!r.isPrimary || !r.zoneMinutesJsonb) continue
      const z = r.zoneMinutesJsonb as ZoneMinutes
      const sum = (z.z2 ?? 0) + (z.z3 ?? 0) + (z.z4 ?? 0) + (z.z5 ?? 0)
      z2ByDate.set(r.date, (z2ByDate.get(r.date) ?? 0) + sum)
    }

    const out: TrendDay[] = []
    for (const date of dates) {
      const breakdown = await loadAndComputeDay(database, userId, date)
      out.push({
        date,
        intake: breakdown.intake,
        burn: breakdown.burn,
        net: breakdown.net,
        sleepScore: sleepByDate.get(date) ?? null,
        z2plusMinutes: z2ByDate.get(date) ?? 0,
        weightKg: null,
      })
    }

    return c.json({ ok: true, days: out })
  })

  return app
}

function lastNDates(n: number): string[] {
  const out: string[] = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}
