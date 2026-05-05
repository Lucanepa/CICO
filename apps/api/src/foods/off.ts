import type { IngestedFood } from './types.js'

const SEARCH = 'https://search.openfoodfacts.org/search'
const PRODUCT = 'https://world.openfoodfacts.org/api/v2/product'

const HEADERS = {
  'user-agent': 'CICO/0.1 (https://cico.lucanepa.com; contact: l.canepa@aequitax.pro)',
  accept: 'application/json',
}

type OffProduct = {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string | string[]
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

type OffSearchHit = OffProduct & {
  brands?: string | string[]
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function brandLabel(brands: string | string[] | undefined): string {
  if (!brands) return ''
  if (Array.isArray(brands)) return brands.filter(Boolean).join(', ')
  return brands
}

function mapOff(p: OffProduct): IngestedFood | null {
  if (!p.code) return null
  const n = p.nutriments ?? {}
  const kcal100g = num(n['energy-kcal_100g']) ?? num(n['energy-kcal'])
  if (kcal100g == null) return null

  const brand = brandLabel(p.brands)
  const display = [brand, p.product_name_en ?? p.product_name].filter(Boolean).join(' — ').trim()

  return {
    source: 'off',
    sourceId: p.code,
    name: display || `OFF ${p.code}`,
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
  url.searchParams.set('q', query)
  url.searchParams.set('page_size', String(pageSize))

  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`off search failed: ${res.status}`)
  const json = (await res.json()) as { hits?: OffSearchHit[]; products?: OffProduct[] }
  const items = json.hits ?? json.products ?? []
  return items.map(mapOff).filter((p): p is IngestedFood => p !== null)
}

export async function offByBarcode(barcode: string): Promise<IngestedFood | null> {
  const url = `${PRODUCT}/${encodeURIComponent(barcode)}.json`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return null
  const json = (await res.json()) as { status?: number; product?: OffProduct }
  if (!json.product) return null
  return mapOff(json.product)
}
