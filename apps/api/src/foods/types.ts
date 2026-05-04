export type Macros = {
  kcal100g: number
  p100g?: number | null
  c100g?: number | null
  f100g?: number | null
  fiber100g?: number | null
}

export type IngestedFood = Macros & {
  source: 'usda' | 'fsvo' | 'off'
  sourceId: string
  name: string
  defaultServingG?: number | null
  barcode?: string | null
  microsJsonb?: Record<string, unknown> | null
}

export type SearchHit = {
  id: string
  table: 'foods' | 'custom_foods'
  source: string
  name: string
  kcal100g: number
  p100g?: number | null
  c100g?: number | null
  f100g?: number | null
  defaultServingG?: number | null
  barcode?: string | null
}
