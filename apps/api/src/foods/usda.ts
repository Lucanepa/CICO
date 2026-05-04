import type { IngestedFood } from './types.js'

const SEARCH = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const FOOD = 'https://api.nal.usda.gov/fdc/v1/food'

type UsdaSearchResponse = {
  foods: Array<{
    fdcId: number
    description: string
    foodCategory?: string
    gtinUpc?: string
    foodNutrients: Array<{ nutrientId?: number; nutrientName?: string; value?: number }>
    servingSize?: number
    servingSizeUnit?: string
  }>
}

const NUTRIENT = {
  KCAL: 1008,
  PROTEIN_G: 1003,
  CARBS_G: 1005,
  FAT_G: 1004,
  FIBER_G: 1079,
} as const

export async function usdaSearch(apiKey: string, query: string, pageSize = 25): Promise<IngestedFood[]> {
  const url = new URL(SEARCH)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('query', query)
  url.searchParams.set('pageSize', String(pageSize))
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Branded')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`usda search failed: ${res.status}`)
  const json = (await res.json()) as UsdaSearchResponse

  return json.foods
    .map((f) => mapUsda(f))
    .filter((f): f is IngestedFood => f !== null)
}

export async function usdaGet(apiKey: string, fdcId: number): Promise<IngestedFood | null> {
  const url = new URL(`${FOOD}/${fdcId}`)
  url.searchParams.set('api_key', apiKey)
  const res = await fetch(url)
  if (!res.ok) return null
  const food = (await res.json()) as UsdaSearchResponse['foods'][number]
  return mapUsda(food)
}

function mapUsda(f: UsdaSearchResponse['foods'][number]): IngestedFood | null {
  const find = (id: number) => f.foodNutrients.find((n) => n.nutrientId === id)?.value
  const kcal100g = find(NUTRIENT.KCAL)
  if (kcal100g == null) return null

  return {
    source: 'usda',
    sourceId: String(f.fdcId),
    name: f.description,
    kcal100g,
    p100g: find(NUTRIENT.PROTEIN_G) ?? null,
    c100g: find(NUTRIENT.CARBS_G) ?? null,
    f100g: find(NUTRIENT.FAT_G) ?? null,
    fiber100g: find(NUTRIENT.FIBER_G) ?? null,
    defaultServingG: f.servingSizeUnit?.toLowerCase() === 'g' ? f.servingSize ?? null : null,
    barcode: f.gtinUpc ?? null,
  }
}
