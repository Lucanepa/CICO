import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { schema } from '@cico/db'
import { getRequestEmail } from '../lib/auth.js'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { getOrCreateDefaultUser } from '../lib/user.js'

const manualSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  weightKg: z.number().positive().optional(),
  fatPct: z.number().min(0).max(100).optional(),
  muscleMassKg: z.number().positive().optional(),
  skeletalMusclePct: z.number().min(0).max(100).optional(),
  boneMassKg: z.number().positive().optional(),
  waterPct: z.number().min(0).max(100).optional(),
  visceralFat: z.number().nonnegative().optional(),
  bmrKcal: z.number().int().positive().optional(),
  bodyAge: z.number().int().positive().optional(),
  bmi: z.number().positive().optional(),
  note: z.string().max(200).optional(),
})

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

  app.post('/log', async (c) => {
    const json = await c.req.json().catch(() => null)
    const parsed = manualSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', issues: parsed.error.flatten() }, 400)
    }
    const data = parsed.data
    const hasAnyField =
      data.weightKg != null ||
      data.fatPct != null ||
      data.muscleMassKg != null ||
      data.skeletalMusclePct != null ||
      data.boneMassKg != null ||
      data.waterPct != null ||
      data.visceralFat != null ||
      data.bmrKcal != null ||
      data.bodyAge != null ||
      data.bmi != null
    if (!hasAnyField) return c.json({ error: 'no_fields_provided' }, 400)

    const now = new Date()
    const tzDate = data.date ?? localIsoDate(env.TZ)
    const time = data.time ?? now.toISOString().slice(11, 19)
    const measuredAt = new Date(`${tzDate}T${time.length === 5 ? `${time}:00` : time}Z`)
    const sourceId = `${tzDate}T${time}Z`

    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))
    const inserted = await database
      .insert(schema.bodyMeasurements)
      .values({
        userId,
        date: tzDate,
        measuredAt,
        time,
        source: 'manual',
        sourceId,
        weightKg: data.weightKg ?? null,
        fatPct: data.fatPct ?? null,
        muscleMassKg: data.muscleMassKg ?? null,
        skeletalMusclePct: data.skeletalMusclePct ?? null,
        boneMassKg: data.boneMassKg ?? null,
        waterPct: data.waterPct ?? null,
        visceralFat: data.visceralFat ?? null,
        bmrKcal: data.bmrKcal ?? null,
        bodyAge: data.bodyAge ?? null,
        bmi: data.bmi ?? null,
        rawPayloadJsonb: { note: data.note },
      })
      .onConflictDoUpdate({
        target: [
          schema.bodyMeasurements.userId,
          schema.bodyMeasurements.source,
          schema.bodyMeasurements.sourceId,
        ],
        set: {
          weightKg: data.weightKg ?? null,
          fatPct: data.fatPct ?? null,
          muscleMassKg: data.muscleMassKg ?? null,
          skeletalMusclePct: data.skeletalMusclePct ?? null,
          boneMassKg: data.boneMassKg ?? null,
          waterPct: data.waterPct ?? null,
          visceralFat: data.visceralFat ?? null,
          bmrKcal: data.bmrKcal ?? null,
          bodyAge: data.bodyAge ?? null,
          bmi: data.bmi ?? null,
          rawPayloadJsonb: { note: data.note },
        },
      })
      .returning({ id: schema.bodyMeasurements.id })
    return c.json({ ok: true, id: inserted[0]?.id ?? null })
  })

  app.delete('/log/:id', async (c) => {
    const id = c.req.param('id')
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))
    const deleted = await database
      .delete(schema.bodyMeasurements)
      .where(
        and(
          eq(schema.bodyMeasurements.id, id),
          eq(schema.bodyMeasurements.userId, userId),
          eq(schema.bodyMeasurements.source, 'manual'),
        ),
      )
      .returning({ id: schema.bodyMeasurements.id })
    if (deleted.length === 0) return c.json({ error: 'not_found' }, 404)
    return c.json({ ok: true })
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

function localIsoDate(tz: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}
