import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { schema } from '@cico/db'
import { getRequestEmail } from '../lib/auth.js'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { getOrCreateDefaultUser } from '../lib/user.js'

export function bodyRoute(env: Env) {
  const app = new Hono()

  app.get('/latest', async (c) => {
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))
    const rows = await database
      .select()
      .from(schema.bodyMeasurements)
      .where(eq(schema.bodyMeasurements.userId, userId))
      .orderBy(desc(schema.bodyMeasurements.measuredAt), desc(schema.bodyMeasurements.date))
      .limit(1)
    return c.json({ ok: true, measurement: rows[0] ?? null })
  })

  app.get('/series', async (c) => {
    const days = clampInt(c.req.query('days'), 1, 365, 90)
    const start = new Date()
    start.setUTCDate(start.getUTCDate() - days)
    const startDate = start.toISOString().slice(0, 10)
    const endDate = new Date().toISOString().slice(0, 10)

    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))
    const rows = await database
      .select({
        date: schema.bodyMeasurements.date,
        measuredAt: schema.bodyMeasurements.measuredAt,
        source: schema.bodyMeasurements.source,
        weightKg: schema.bodyMeasurements.weightKg,
        fatPct: schema.bodyMeasurements.fatPct,
        muscleMassKg: schema.bodyMeasurements.muscleMassKg,
        skeletalMusclePct: schema.bodyMeasurements.skeletalMusclePct,
        boneMassKg: schema.bodyMeasurements.boneMassKg,
        waterPct: schema.bodyMeasurements.waterPct,
        visceralFat: schema.bodyMeasurements.visceralFat,
        bmrKcal: schema.bodyMeasurements.bmrKcal,
      })
      .from(schema.bodyMeasurements)
      .where(
        and(
          eq(schema.bodyMeasurements.userId, userId),
          gte(schema.bodyMeasurements.date, startDate),
          lte(schema.bodyMeasurements.date, endDate),
        ),
      )
      .orderBy(asc(schema.bodyMeasurements.date), asc(schema.bodyMeasurements.measuredAt))
    return c.json({ ok: true, series: rows })
  })

  return app
}

function clampInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const n = raw ? Number(raw) : fallback
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}
