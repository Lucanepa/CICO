import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { and, eq, asc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { getRequestEmail } from '../lib/auth.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { schema } from '@cico/db'

export function foodLogRoute(env: Env) {
  const app = new Hono()

  app.get('/', async (c) => {
    const date = c.req.query('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'invalid_date' }, 400)

    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))

    const rows = await database
      .select()
      .from(schema.foodLog)
      .where(and(eq(schema.foodLog.userId, userId), eq(schema.foodLog.date, date)))
      .orderBy(asc(schema.foodLog.time))
    return c.json({ ok: true, entries: rows })
  })

  const newEntrySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    foodId: z.string().uuid(),
    foodTable: z.enum(['foods', 'custom_foods']),
    quantityG: z.number().positive(),
  })

  app.post('/', zValidator('json', newEntrySchema), async (c) => {
    const body = c.req.valid('json')
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))

    const macros = await loadMacros(database, body.foodId, body.foodTable)
    if (!macros) return c.json({ error: 'food_not_found' }, 404)

    const factor = body.quantityG / 100
    const inserted = await database
      .insert(schema.foodLog)
      .values({
        userId,
        date: body.date,
        time: body.time ?? null,
        foodId: body.foodId,
        foodTable: body.foodTable,
        quantityG: body.quantityG,
        kcal: Math.round(macros.kcal100g * factor),
        p: macros.p100g != null ? round1(macros.p100g * factor) : null,
        c: macros.c100g != null ? round1(macros.c100g * factor) : null,
        f: macros.f100g != null ? round1(macros.f100g * factor) : null,
        sourceLabel: macros.label,
      })
      .returning()
    return c.json({ ok: true, entry: inserted[0] }, 201)
  })

  app.delete('/:id', async (c) => {
    const id = c.req.param('id')
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, getRequestEmail(c, env))
    await database
      .delete(schema.foodLog)
      .where(and(eq(schema.foodLog.id, id), eq(schema.foodLog.userId, userId)))
    return c.json({ ok: true })
  })

  return app
}

async function loadMacros(
  db: import('@cico/db').Database,
  foodId: string,
  table: 'foods' | 'custom_foods',
): Promise<{
  kcal100g: number
  p100g: number | null
  c100g: number | null
  f100g: number | null
  label: string
} | null> {
  if (table === 'foods') {
    const rows = await db
      .select({
        kcal100g: schema.foods.kcal100g,
        p100g: schema.foods.p100g,
        c100g: schema.foods.c100g,
        f100g: schema.foods.f100g,
        source: schema.foods.source,
        name: schema.foods.name,
      })
      .from(schema.foods)
      .where(eq(schema.foods.id, foodId))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return {
      kcal100g: row.kcal100g,
      p100g: row.p100g,
      c100g: row.c100g,
      f100g: row.f100g,
      label: `${row.source}:${row.name}`,
    }
  }
  const rows = await db
    .select({
      kcal100g: schema.customFoods.kcal100g,
      p100g: schema.customFoods.p100g,
      c100g: schema.customFoods.c100g,
      f100g: schema.customFoods.f100g,
      name: schema.customFoods.name,
    })
    .from(schema.customFoods)
    .where(eq(schema.customFoods.id, foodId))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    kcal100g: row.kcal100g,
    p100g: row.p100g,
    c100g: row.c100g,
    f100g: row.f100g,
    label: `custom:${row.name}`,
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10
