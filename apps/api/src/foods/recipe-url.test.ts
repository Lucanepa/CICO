import { describe, expect, it, vi, afterEach } from 'vitest'
import { importRecipeFromUrl } from './recipe-url.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const html = (jsonld: object) =>
  `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(jsonld)}</script></head><body></body></html>`

describe('importRecipeFromUrl', () => {
  it('parses standard JSON-LD Recipe with per-serving nutrition', async () => {
    const recipe = {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Banana Bread',
      recipeYield: '8 servings',
      nutrition: {
        '@type': 'NutritionInformation',
        calories: '220 kcal',
        proteinContent: '4 g',
        carbohydrateContent: '36 g',
        fatContent: '7 g',
        fiberContent: '2 g',
        servingSize: '85 g',
      },
    }
    globalThis.fetch = vi.fn(async () => new Response(html(recipe), { status: 200 })) as never

    const r = await importRecipeFromUrl('https://example.com/banana-bread')
    expect(r).not.toBeNull()
    expect(r!.name).toBe('Banana Bread')
    expect(r!.servings).toBe(8)
    expect(r!.totalKcal).toBe(220)
    expect(r!.kcal100g).toBeCloseTo((220 * 100) / 85)
    expect(r!.p100g).toBeCloseTo((4 * 100) / 85)
    expect(r!.defaultServingG).toBe(85)
  })

  it('descends into @graph nodes', async () => {
    const doc = {
      '@graph': [
        { '@type': 'WebPage', name: 'foo' },
        {
          '@type': 'Recipe',
          name: 'Pasta',
          recipeYield: 4,
          nutrition: { calories: '500', servingSize: '250 g' },
        },
      ],
    }
    globalThis.fetch = vi.fn(async () => new Response(html(doc), { status: 200 })) as never
    const r = await importRecipeFromUrl('https://example.com/pasta')
    expect(r?.name).toBe('Pasta')
    expect(r?.kcal100g).toBeCloseTo(200)
  })

  it('returns null when no Recipe JSON-LD is present', async () => {
    globalThis.fetch = vi.fn(async () => new Response('<html></html>', { status: 200 })) as never
    expect(await importRecipeFromUrl('https://example.com/x')).toBeNull()
  })

  it('returns null kcal100g when serving size is unavailable', async () => {
    const recipe = {
      '@type': 'Recipe',
      name: 'Mystery dish',
      nutrition: { calories: '300' },
    }
    globalThis.fetch = vi.fn(async () => new Response(html(recipe), { status: 200 })) as never
    const r = await importRecipeFromUrl('https://example.com/mystery')
    expect(r?.kcal100g).toBeNull()
    expect(r?.totalKcal).toBe(300)
  })
})
