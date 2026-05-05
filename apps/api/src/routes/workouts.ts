import { and, asc, between, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { schema } from '@cico/db'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { getRequestEmail } from '../lib/auth.js'
import { loadHrSettings } from '../lib/hr-settings.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { defaultMaxHr } from '@cico/shared'

export function workoutsRoute(env: Env) {
  const app = new Hono()

  app.get('/', async (c) => {
    const date = c.req.query('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'invalid_date' }, 400)
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))

    const rows = await database
      .select({
        id: schema.workouts.id,
        date: schema.workouts.date,
        startTime: schema.workouts.startTime,
        endTime: schema.workouts.endTime,
        source: schema.workouts.source,
        sourceId: schema.workouts.sourceId,
        type: schema.workouts.type,
        durationMin: schema.workouts.durationMin,
        calories: schema.workouts.calories,
        avgHr: schema.workouts.avgHr,
        maxHr: schema.workouts.maxHr,
        zoneMinutesJsonb: schema.workouts.zoneMinutesJsonb,
        isPrimary: schema.workouts.isPrimary,
        duplicateOf: schema.workouts.duplicateOf,
      })
      .from(schema.workouts)
      .where(and(eq(schema.workouts.userId, userId), eq(schema.workouts.date, date)))
      .orderBy(asc(schema.workouts.startTime))

    return c.json({ ok: true, workouts: rows })
  })

  const pinSchema = z.object({ id: z.string().uuid() })
  app.post('/pin-primary', zValidator('json', pinSchema), async (c) => {
    const { id } = c.req.valid('json')
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))

    const target = await database
      .select({ id: schema.workouts.id, duplicateOf: schema.workouts.duplicateOf })
      .from(schema.workouts)
      .where(and(eq(schema.workouts.id, id), eq(schema.workouts.userId, userId)))
      .limit(1)
    if (!target[0]) return c.json({ error: 'not_found' }, 404)

    await database.transaction(async (tx) => {
      const oldPrimaryId = target[0]!.duplicateOf
      if (oldPrimaryId) {
        await tx
          .update(schema.workouts)
          .set({ isPrimary: false, duplicateOf: id })
          .where(eq(schema.workouts.id, oldPrimaryId))
        await tx
          .update(schema.workouts)
          .set({ isPrimary: false, duplicateOf: id })
          .where(eq(schema.workouts.duplicateOf, oldPrimaryId))
      }
      await tx
        .update(schema.workouts)
        .set({ isPrimary: true, duplicateOf: null })
        .where(eq(schema.workouts.id, id))
    })

    return c.json({ ok: true })
  })

  app.get('/:id', async (c) => {
    const id = c.req.param('id')
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))

    const rows = await database
      .select()
      .from(schema.workouts)
      .where(and(eq(schema.workouts.id, id), eq(schema.workouts.userId, userId)))
      .limit(1)
    const workout = rows[0]
    if (!workout) return c.json({ error: 'not_found' }, 404)

    const samples = await database
      .select({
        timestamp: schema.heartRateSamples.timestamp,
        bpm: schema.heartRateSamples.bpm,
        source: schema.heartRateSamples.source,
      })
      .from(schema.heartRateSamples)
      .where(
        and(
          eq(schema.heartRateSamples.userId, userId),
          between(schema.heartRateSamples.timestamp, workout.startTime, workout.endTime),
        ),
      )
      .orderBy(asc(schema.heartRateSamples.timestamp))

    const duplicates = workout.isPrimary
      ? await database
          .select()
          .from(schema.workouts)
          .where(eq(schema.workouts.duplicateOf, workout.id))
      : []

    const hr = await loadHrSettings(database, userId)
    const maxHr = hr.maxHrOverride ?? defaultMaxHr(hr.age)

    return c.json({
      ok: true,
      workout,
      samples,
      duplicates,
      maxHr,
    })
  })

  return app
}
