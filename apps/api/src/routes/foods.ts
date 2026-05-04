import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { schema } from '@cico/db'
import { offByBarcode } from '../foods/off.js'
import { offSearch } from '../foods/off.js'
import { findByBarcode, searchFoods, upsertFoods } from '../foods/store.js'
import { usdaSearch } from '../foods/usda.js'

export function foodsRoute(env: Env) {
  const app = new Hono()

  app.get('/search', async (c) => {
    const q = c.req.query('q') ?? ''
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, env.DEFAULT_USER_EMAIL)

    const local = await searchFoods(database, userId, q)
    if (local.length >= 10 || q.length < 3) {
      return c.json({ ok: true, hits: local, sources: ['local'] })
    }

    const remote: { source: string }[] = []
    if (env.USDA_API_KEY) {
      try {
        const usda = await usdaSearch(env.USDA_API_KEY, q, 10)
        await upsertFoods(database, usda)
        remote.push({ source: 'usda' })
      } catch (err) {
        console.warn('[foods] usda search failed', err)
      }
    }
    try {
      const off = await offSearch(q, 10)
      await upsertFoods(database, off)
      remote.push({ source: 'off' })
    } catch (err) {
      console.warn('[foods] off search failed', err)
    }

    const final = await searchFoods(database, userId, q)
    return c.json({ ok: true, hits: final, sources: ['local', ...remote.map((r) => r.source)] })
  })

  app.get('/barcode/:code', async (c) => {
    const code = c.req.param('code')
    const database = db(env.DATABASE_URL)
    const cached = await findByBarcode(database, code)
    if (cached) return c.json({ ok: true, hit: cached, source: 'cache' })

    const remote = await offByBarcode(code)
    if (!remote) return c.json({ error: 'not_found' }, 404)
    await upsertFoods(database, [remote])
    const stored = await findByBarcode(database, code)
    return c.json({ ok: true, hit: stored, source: 'off' })
  })

  const customFoodSchema = z.object({
    name: z.string().min(1),
    kcal100g: z.number().nonnegative(),
    p100g: z.number().nonnegative().nullish(),
    c100g: z.number().nonnegative().nullish(),
    f100g: z.number().nonnegative().nullish(),
    fiber100g: z.number().nonnegative().nullish(),
    defaultServingG: z.number().positive().nullish(),
  })

  app.post('/custom', zValidator('json', customFoodSchema), async (c) => {
    const body = c.req.valid('json')
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, env.DEFAULT_USER_EMAIL)
    const inserted = await database
      .insert(schema.customFoods)
      .values({
        userId,
        name: body.name,
        kcal100g: body.kcal100g,
        p100g: body.p100g ?? null,
        c100g: body.c100g ?? null,
        f100g: body.f100g ?? null,
        fiber100g: body.fiber100g ?? null,
        defaultServingG: body.defaultServingG ?? null,
      })
      .returning()
    return c.json({ ok: true, food: inserted[0] }, 201)
  })

  app.delete('/custom/:id', async (c) => {
    const id = c.req.param('id')
    const database = db(env.DATABASE_URL)
    const userId = await getOrCreateDefaultUser(database, env.DEFAULT_USER_EMAIL)
    await database
      .delete(schema.customFoods)
      .where(and(eq(schema.customFoods.id, id), eq(schema.customFoods.userId, userId)))
    return c.json({ ok: true })
  })

  return app
}
