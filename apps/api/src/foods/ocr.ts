import Anthropic from '@anthropic-ai/sdk'
import type { IngestedFood } from './types.js'

const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You are a nutrition-label OCR. Given a photo of a food package nutrition table, extract the macros per 100 g (or per 100 ml — treat ml as g for liquids).

Return STRICT JSON in this exact shape, no prose:
{
  "name": "<readable product name>",
  "kcal_100g": <number>,
  "protein_100g": <number|null>,
  "carbs_100g": <number|null>,
  "fat_100g": <number|null>,
  "fiber_100g": <number|null>,
  "default_serving_g": <number|null>,
  "barcode": "<string|null>",
  "confidence": "high"|"medium"|"low",
  "warnings": ["<string>", ...]
}

Rules:
- If the label only shows "per serving", convert to per 100g using the stated serving size.
- If you can read both, prefer the per-100g column (more accurate).
- For energy in kJ only, divide by 4.184 to get kcal.
- If a field is unreadable, set it to null and add a warning.
- "name" should include brand if visible, then the product name.
- Never guess values. Null is better than wrong.`

export type OcrFoodResult = {
  name: string
  kcal_100g: number
  protein_100g: number | null
  carbs_100g: number | null
  fat_100g: number | null
  fiber_100g: number | null
  default_serving_g: number | null
  barcode: string | null
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}

export class OcrConfigError extends Error {}

export async function extractNutritionFromImage(opts: {
  apiKey: string
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
}): Promise<OcrFoodResult> {
  const client = new Anthropic({ apiKey: opts.apiKey })

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: opts.mimeType, data: opts.imageBase64 },
          },
          { type: 'text', text: 'Extract the nutrition info as JSON.' },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('claude returned no text content')
  }
  const jsonText = stripFences(textBlock.text)
  const parsed = JSON.parse(jsonText) as OcrFoodResult
  if (typeof parsed.kcal_100g !== 'number' || !Number.isFinite(parsed.kcal_100g)) {
    throw new Error('ocr response missing kcal_100g')
  }
  return parsed
}

export function ocrToCustomFood(r: OcrFoodResult): {
  name: string
  kcal100g: number
  p100g: number | null
  c100g: number | null
  f100g: number | null
  fiber100g: number | null
  defaultServingG: number | null
} {
  return {
    name: r.name,
    kcal100g: r.kcal_100g,
    p100g: r.protein_100g,
    c100g: r.carbs_100g,
    f100g: r.fat_100g,
    fiber100g: r.fiber_100g,
    defaultServingG: r.default_serving_g,
  }
}

export function ocrToFoodsRow(r: OcrFoodResult, sourceId: string): IngestedFood {
  return {
    source: 'off',
    sourceId,
    name: r.name,
    kcal100g: r.kcal_100g,
    p100g: r.protein_100g,
    c100g: r.carbs_100g,
    f100g: r.fat_100g,
    fiber100g: r.fiber_100g,
    defaultServingG: r.default_serving_g,
    barcode: r.barcode,
  }
}

function stripFences(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return (fenced?.[1] ?? s).trim()
}
