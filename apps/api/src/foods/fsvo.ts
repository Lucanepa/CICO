import { readFileSync } from 'node:fs'
import type { IngestedFood } from './types.js'

/**
 * Swiss FSVO (Schweizer Nährwertdatenbank) export. The CSV is published
 * with one row per food and ~70 columns. We only parse the columns we
 * map; extra columns are ignored. The header is detected by name (case
 * insensitive, trimmed, German + English aliases).
 */

type ColIdx = {
  id?: number
  name: number
  kcal: number
  p: number
  c: number
  f: number
  fiber?: number
}

const NAME_KEYS = ['name', 'name de', 'lebensmittel']
const ID_KEYS = ['id', 'lm_code', 'food_id']
const KCAL_KEYS = ['energie kcal', 'energy kcal', 'energie (kcal)', 'kcal']
const PROTEIN_KEYS = ['protein', 'eiweiss', 'eiweiß']
const CARBS_KEYS = ['kohlenhydrate', 'carbohydrate', 'carbs']
const FAT_KEYS = ['fett', 'fat']
const FIBER_KEYS = ['nahrungsfasern', 'ballaststoffe', 'fiber', 'dietary fibre']

function findCol(headers: string[], keys: string[]): number | undefined {
  const lc = headers.map((h) => h.toLowerCase().trim())
  for (const k of keys) {
    const idx = lc.indexOf(k)
    if (idx >= 0) return idx
  }
  for (const k of keys) {
    const idx = lc.findIndex((h) => h.includes(k))
    if (idx >= 0) return idx
  }
  return undefined
}

function splitCsv(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQ = false
        }
      } else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === sep) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

export function parseFsvoCsv(text: string): IngestedFood[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const sep = (lines[0]?.split(';').length ?? 0) >= (lines[0]?.split(',').length ?? 0) ? ';' : ','
  const headers = splitCsv(lines.shift()!, sep)

  const idx: ColIdx | null = (() => {
    const name = findCol(headers, NAME_KEYS)
    const kcal = findCol(headers, KCAL_KEYS)
    const p = findCol(headers, PROTEIN_KEYS)
    const c = findCol(headers, CARBS_KEYS)
    const f = findCol(headers, FAT_KEYS)
    if (name === undefined || kcal === undefined || p === undefined || c === undefined || f === undefined) {
      return null
    }
    const result: ColIdx = { name, kcal, p, c, f }
    const id = findCol(headers, ID_KEYS)
    const fiber = findCol(headers, FIBER_KEYS)
    if (id !== undefined) result.id = id
    if (fiber !== undefined) result.fiber = fiber
    return result
  })()
  if (!idx) return []

  const out: IngestedFood[] = []
  for (const [i, line] of lines.entries()) {
    const cols = splitCsv(line, sep)
    const name = cols[idx.name]?.trim()
    const kcalRaw = cols[idx.kcal]
    if (!name || !kcalRaw) continue
    const kcal = Number(kcalRaw.replace(',', '.'))
    if (!Number.isFinite(kcal)) continue
    const sourceId = idx.id !== undefined ? cols[idx.id]?.trim() || String(i) : String(i)

    out.push({
      source: 'fsvo',
      sourceId,
      name,
      kcal100g: kcal,
      p100g: parseNum(cols[idx.p]),
      c100g: parseNum(cols[idx.c]),
      f100g: parseNum(cols[idx.f]),
      fiber100g: idx.fiber !== undefined ? parseNum(cols[idx.fiber]) : null,
    })
  }
  return out
}

function parseNum(raw: string | undefined): number | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-') return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function loadFsvoFromFile(path: string): IngestedFood[] {
  return parseFsvoCsv(readFileSync(path, 'utf8'))
}
