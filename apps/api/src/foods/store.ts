import { and, eq, ilike, or, sql } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'
import type { IngestedFood, SearchHit } from './types.js'

export async function upsertFoods(db: Database, foods: IngestedFood[]): Promise<number> {
  if (foods.length === 0) return 0
  const rows = foods.map((f) => ({
    source: f.source,
    sourceId: f.sourceId,
    name: f.name,
    kcal100g: f.kcal100g,
    p100g: f.p100g ?? null,
    c100g: f.c100g ?? null,
    f100g: f.f100g ?? null,
    fiber100g: f.fiber100g ?? null,
    microsJsonb: f.microsJsonb ?? null,
    defaultServingG: f.defaultServingG ?? null,
    barcode: f.barcode ?? null,
  }))

  let count = 0
  for (const r of rows) {
    const existing = await db
      .select({ id: schema.foods.id })
      .from(schema.foods)
      .where(and(eq(schema.foods.source, r.source), eq(schema.foods.sourceId, r.sourceId)))
      .limit(1)

    if (existing[0]) {
      await db.update(schema.foods).set(r).where(eq(schema.foods.id, existing[0].id))
    } else {
      await db.insert(schema.foods).values(r)
    }
    count++
  }
  return count
}

export async function searchFoods(
  db: Database,
  userId: string,
  query: string,
  limit = 25,
): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const pattern = `%${trimmed}%`

  const customs = await db
    .select({
      id: schema.customFoods.id,
      name: schema.customFoods.name,
      kcal100g: schema.customFoods.kcal100g,
      p100g: schema.customFoods.p100g,
      c100g: schema.customFoods.c100g,
      f100g: schema.customFoods.f100g,
      defaultServingG: schema.customFoods.defaultServingG,
    })
    .from(schema.customFoods)
    .where(
      and(eq(schema.customFoods.userId, userId), ilike(schema.customFoods.name, pattern)),
    )
    .limit(limit)

  const fdc = await db
    .select({
      id: schema.foods.id,
      source: schema.foods.source,
      name: schema.foods.name,
      kcal100g: schema.foods.kcal100g,
      p100g: schema.foods.p100g,
      c100g: schema.foods.c100g,
      f100g: schema.foods.f100g,
      defaultServingG: schema.foods.defaultServingG,
      barcode: schema.foods.barcode,
    })
    .from(schema.foods)
    .where(or(ilike(schema.foods.name, pattern), eq(schema.foods.barcode, trimmed)))
    .orderBy(sql`length(${schema.foods.name})`)
    .limit(limit)

  const hits: SearchHit[] = [
    ...customs.map((c) => ({
      id: c.id,
      table: 'custom_foods' as const,
      source: 'custom',
      name: c.name,
      kcal100g: c.kcal100g,
      p100g: c.p100g,
      c100g: c.c100g,
      f100g: c.f100g,
      defaultServingG: c.defaultServingG,
    })),
    ...fdc.map((f) => ({
      id: f.id,
      table: 'foods' as const,
      source: f.source,
      name: f.name,
      kcal100g: f.kcal100g,
      p100g: f.p100g,
      c100g: f.c100g,
      f100g: f.f100g,
      defaultServingG: f.defaultServingG,
      barcode: f.barcode,
    })),
  ]
  return hits.slice(0, limit)
}

export async function findByBarcode(db: Database, barcode: string) {
  const rows = await db
    .select()
    .from(schema.foods)
    .where(eq(schema.foods.barcode, barcode))
    .limit(1)
  return rows[0] ?? null
}
