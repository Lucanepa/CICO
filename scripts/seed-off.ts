/**
 * Seed the local foods table from the Open Food Facts JSONL dump.
 * Streams the gzipped feed (~2 GB), filters for products sold in our
 * target countries with valid kcal data and meaningful scan counts,
 * and bulk-upserts in batches.
 *
 * Usage:
 *   pnpm tsx scripts/seed-off.ts                    # full seed
 *   MIN_POPULARITY=50 COUNTRIES=ch,it,de pnpm ...   # tighter filter
 *   MAX_PRODUCTS=10000 pnpm tsx scripts/seed-off.ts # cap for testing
 */
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { createDb, schema } from '@cico/db'
import { sql } from 'drizzle-orm'

const URL = 'https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz'

const COUNTRIES = (process.env.COUNTRIES ?? 'ch,it,de,fr,at,uk,us')
  .toLowerCase()
  .split(',')
  .map((c) => `en:${c.trim() === 'uk' ? 'united-kingdom' : c.trim() === 'us' ? 'united-states' : countryName(c.trim())}`)

function countryName(c: string): string {
  const map: Record<string, string> = {
    ch: 'switzerland',
    it: 'italy',
    de: 'germany',
    fr: 'france',
    at: 'austria',
    es: 'spain',
    nl: 'netherlands',
    be: 'belgium',
    pt: 'portugal',
    se: 'sweden',
    dk: 'denmark',
    no: 'norway',
    pl: 'poland',
  }
  return map[c] ?? c
}

const MIN_POPULARITY = Number(process.env.MIN_POPULARITY ?? '20')
const MAX_PRODUCTS = process.env.MAX_PRODUCTS ? Number(process.env.MAX_PRODUCTS) : Infinity
const BATCH_SIZE = 500

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL not set')
const db = createDb(dbUrl)

type OffRow = {
  code?: string
  product_name?: string
  product_name_en?: string
  product_name_it?: string
  product_name_de?: string
  product_name_fr?: string
  brands?: string
  countries_tags?: string[]
  categories_tags?: string[]
  unique_scans_n?: number
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

type FoodRow = {
  source: 'off'
  sourceId: string
  name: string
  kcal100g: number
  p100g: number | null
  c100g: number | null
  f100g: number | null
  fiber100g: number | null
  defaultServingG: number | null
  barcode: string
  microsJsonb: { categories?: string[] } | null
}

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickName(p: OffRow): string | null {
  const candidate =
    p.product_name_en ??
    p.product_name ??
    p.product_name_it ??
    p.product_name_de ??
    p.product_name_fr
  if (!candidate || candidate.trim().length < 2) return null
  const brand = p.brands?.split(',')[0]?.trim()
  return brand ? `${brand} — ${candidate.trim()}` : candidate.trim()
}

function mapRow(p: OffRow): FoodRow | null {
  if (!p.code) return null
  const n = p.nutriments ?? {}
  const kcal = num(n['energy-kcal_100g']) ?? num(n['energy-kcal'])
  if (kcal == null || kcal < 1 || kcal > 1000) return null
  const name = pickName(p)
  if (!name) return null

  return {
    source: 'off',
    sourceId: p.code,
    name,
    kcal100g: kcal,
    p100g: num(n['proteins_100g']),
    c100g: num(n['carbohydrates_100g']),
    f100g: num(n['fat_100g']),
    fiber100g: num(n['fiber_100g']),
    defaultServingG: num(p.serving_quantity),
    barcode: p.code,
    microsJsonb: p.categories_tags ? { categories: p.categories_tags.slice(0, 8) } : null,
  }
}

async function flush(batch: FoodRow[]): Promise<number> {
  if (batch.length === 0) return 0
  await db
    .insert(schema.foods)
    .values(batch)
    .onConflictDoUpdate({
      target: [schema.foods.source, schema.foods.sourceId],
      set: {
        name: sql`excluded.name`,
        kcal100g: sql`excluded.kcal_100g`,
        p100g: sql`excluded.p_100g`,
        c100g: sql`excluded.c_100g`,
        f100g: sql`excluded.f_100g`,
        fiber100g: sql`excluded.fiber_100g`,
        defaultServingG: sql`excluded.default_serving_g`,
        barcode: sql`excluded.barcode`,
        microsJsonb: sql`excluded.micros_jsonb`,
      },
    })
  return batch.length
}

async function main(): Promise<void> {
  console.log(`[seed-off] target countries: ${COUNTRIES.join(', ')}`)
  console.log(`[seed-off] min popularity: ${MIN_POPULARITY}`)
  console.log(`[seed-off] downloading ${URL}`)

  const res = await fetch(URL, {
    headers: {
      'user-agent': 'CICO/0.1 (https://cico.lucanepa.com; contact: l.canepa@aequitax.pro)',
    },
  })
  if (!res.ok || !res.body) throw new Error(`OFF dump fetch failed: ${res.status}`)

  const stream = Readable.fromWeb(res.body as never).pipe(createGunzip())
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  const batch: FoodRow[] = []
  let scanned = 0
  let kept = 0
  const t0 = Date.now()

  for await (const line of rl) {
    scanned++
    if (scanned % 50_000 === 0) {
      const sec = Math.round((Date.now() - t0) / 1000)
      console.log(`[seed-off] scanned ${scanned.toLocaleString()} kept ${kept.toLocaleString()} (${sec}s)`)
    }
    if (kept >= MAX_PRODUCTS) break

    let p: OffRow
    try {
      p = JSON.parse(line) as OffRow
    } catch {
      continue
    }

    if ((p.unique_scans_n ?? 0) < MIN_POPULARITY) continue
    if (!p.countries_tags?.some((c) => COUNTRIES.includes(c))) continue

    const row = mapRow(p)
    if (!row) continue

    batch.push(row)
    kept++

    if (batch.length >= BATCH_SIZE) {
      await flush(batch)
      batch.length = 0
    }
  }

  if (batch.length > 0) await flush(batch)
  const sec = Math.round((Date.now() - t0) / 1000)
  console.log(`[seed-off] DONE scanned=${scanned.toLocaleString()} kept=${kept.toLocaleString()} (${sec}s)`)
}

main().catch((err) => {
  console.error('[seed-off] failed:', err)
  process.exit(1)
})
