/**
 * Recipe importer for sites that publish schema.org/Recipe JSON-LD.
 * Most modern food blogs embed this; coverage is uneven but free to try.
 */

export type RecipeImport = {
  name: string
  kcal100g: number | null
  p100g: number | null
  c100g: number | null
  f100g: number | null
  fiber100g: number | null
  defaultServingG: number | null
  servings: number | null
  totalKcal: number | null
  url: string
  source: 'jsonld'
}

const NUM_RE = /(-?\d+(?:[.,]\d+)?)/

const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const m = v.replace(',', '.').match(NUM_RE)
    if (!m) return null
    const n = Number(m[1])
    return Number.isFinite(n) ? n : null
  }
  return null
}

type NutritionInfo = Record<string, unknown>
type RecipeNode = {
  '@type'?: string | string[]
  name?: string
  recipeYield?: string | number | string[]
  nutrition?: NutritionInfo
}

function isRecipe(node: unknown): node is RecipeNode {
  if (!node || typeof node !== 'object') return false
  const t = (node as { '@type'?: unknown })['@type']
  if (t === 'Recipe') return true
  if (Array.isArray(t)) return t.includes('Recipe')
  return false
}

function findRecipes(node: unknown, out: RecipeNode[] = []): RecipeNode[] {
  if (Array.isArray(node)) {
    for (const item of node) findRecipes(item, out)
    return out
  }
  if (node && typeof node === 'object') {
    if (isRecipe(node)) out.push(node)
    const graph = (node as { '@graph'?: unknown })['@graph']
    if (graph) findRecipes(graph, out)
  }
  return out
}

function parseServings(yld: RecipeNode['recipeYield']): number | null {
  if (yld == null) return null
  if (typeof yld === 'number') return yld
  if (typeof yld === 'string') return num(yld)
  if (Array.isArray(yld)) {
    for (const item of yld) {
      const n = num(item)
      if (n != null) return n
    }
  }
  return null
}

export async function importRecipeFromUrl(url: string): Promise<RecipeImport | null> {
  const res = await fetch(url, {
    headers: { 'user-agent': 'CICO/0.1 (recipe-import)', accept: 'text/html' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  const html = await res.text()

  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const recipes: RecipeNode[] = []
  for (const m of blocks) {
    const raw = (m[1] ?? '').trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      findRecipes(parsed, recipes)
    } catch {
      // skip malformed JSON-LD blocks
    }
  }
  if (recipes.length === 0) return null

  const recipe = recipes[0]!
  const nutrition = (recipe.nutrition ?? {}) as Record<string, unknown>

  const totalKcal = num(nutrition['calories'] ?? nutrition['energy'])
  const p = num(nutrition['proteinContent'])
  const c = num(nutrition['carbohydrateContent'])
  const f = num(nutrition['fatContent'])
  const fib = num(nutrition['fiberContent'])
  const servingSize = num(nutrition['servingSize'])
  const servings = parseServings(recipe.recipeYield)

  let kcal100g: number | null = null
  let p100g: number | null = null
  let c100g: number | null = null
  let f100g: number | null = null
  let fiber100g: number | null = null
  let defaultServingG: number | null = servingSize

  if (servingSize && totalKcal != null) {
    const factor = 100 / servingSize
    kcal100g = totalKcal * factor
    if (p != null) p100g = p * factor
    if (c != null) c100g = c * factor
    if (f != null) f100g = f * factor
    if (fib != null) fiber100g = fib * factor
  }

  const result: RecipeImport = {
    name: typeof recipe.name === 'string' ? recipe.name : url,
    kcal100g,
    p100g,
    c100g,
    f100g,
    fiber100g,
    defaultServingG,
    servings,
    totalKcal,
    url,
    source: 'jsonld',
  }
  return result
}
