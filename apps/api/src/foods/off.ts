import type { IngestedFood } from './types.js'

const SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl'
const PRODUCT = 'https://world.openfoodfacts.org/api/v2/product'

type OffProduct = {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function mapOff(p: OffProduct): IngestedFood | null {
  if (!p.code) return null
  const n = p.nutriments ?? {}
  const kcal100g = num(n['energy-kcal_100g']) ?? num(n['energy-kcal'])
  if (kcal100g == null) return null

  return {
    source: 'off',
    sourceId: p.code,
    name: [p.brands, p.product_name_en ?? p.product_name].filter(Boolean).join(' — ').trim() ||
      `OFF ${p.code}`,
    kcal100g,
    p100g: num(n['proteins_100g']),
    c100g: num(n['carbohydrates_100g']),
    f100g: num(n['fat_100g']),
    fiber100g: num(n['fiber_100g']),
    defaultServingG: num(p.serving_quantity),
    barcode: p.code,
  }
}

export async function offSearch(query: string, pageSize = 25): Promise<IngestedFood[]> {
  const url = new URL(SEARCH)
  url.searchParams.set('search_terms', query)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('action', 'process')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set(
    'fields',
    'code,product_name,product_name_en,brands,serving_quantity,nutriments',
  )

  const res = await fetch(url, {
    headers: {
      'user-agent': 'CICO/0.1 (https://cico.lucanepa.com; contact: l.canepa@aequitax.pro)',
      accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`off search failed: ${res.status}`)
  const json = (await res.json()) as { products: OffProduct[] }
  return json.products.map(mapOff).filter((p): p is IngestedFood => p !== null)
}

export async function offByBarcode(barcode: string): Promise<IngestedFood | null> {
  const url = `${PRODUCT}/${encodeURIComponent(barcode)}.json`
  const res = await fetch(url, {
    headers: {
      'user-agent': 'CICO/0.1 (https://cico.lucanepa.com; contact: l.canepa@aequitax.pro)',
      accept: 'application/json',
    },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { status?: number; product?: OffProduct }
  if (!json.product) return null
  return mapOff(json.product)
}
