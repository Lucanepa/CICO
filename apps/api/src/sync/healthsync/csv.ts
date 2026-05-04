/**
 * Health Sync writes one CSV per Health Connect data type. We only
 * consume rows tagged as Huawei here. Schema we care about (Health Sync
 * "All data, one row per record" export):
 *
 *   "Type","Date","Time","Value","Unit","Source","Notes"
 *
 * Types of interest:
 *   - "Active calories burned"   (kcal, per-event timestamps)
 *   - "Total calories burned"    (kcal, per-event timestamps)
 *   - "Steps"                    (count)
 *   - "Resting heart rate"       (bpm)
 *   - "Heart rate"               (bpm sample stream)
 *
 * Health Sync's own CSV format has shifted over versions; we accept any
 * superset that includes Type/Date/Value/Source columns.
 */

export type HealthSyncRow = {
  type: string
  date: string
  time?: string
  value: number
  unit?: string
  source: string
}

export function parseHealthSyncCsv(text: string): HealthSyncRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const headerLine = lines.shift()!
  const headers = splitCsvLine(headerLine).map((h) => h.toLowerCase().trim())

  const idx = {
    type: headers.indexOf('type'),
    date: headers.indexOf('date'),
    time: headers.indexOf('time'),
    value: headers.indexOf('value'),
    unit: headers.indexOf('unit'),
    source: headers.indexOf('source'),
  }
  if (idx.type < 0 || idx.date < 0 || idx.value < 0 || idx.source < 0) {
    return []
  }

  const out: HealthSyncRow[] = []
  for (const line of lines) {
    const cols = splitCsvLine(line)
    const valueRaw = cols[idx.value]
    if (valueRaw === undefined) continue
    const value = Number(valueRaw)
    if (!Number.isFinite(value)) continue
    out.push({
      type: cols[idx.type] ?? '',
      date: cols[idx.date] ?? '',
      time: idx.time >= 0 ? cols[idx.time] : undefined,
      value,
      unit: idx.unit >= 0 ? cols[idx.unit] : undefined,
      source: cols[idx.source] ?? '',
    })
  }
  return out
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else {
      if (ch === ',') {
        out.push(cur)
        cur = ''
      } else if (ch === '"') {
        inQuotes = true
      } else {
        cur += ch
      }
    }
  }
  out.push(cur)
  return out
}

export type HuaweiDailyAggregate = {
  date: string
  totalCalories?: number
  activeCalories?: number
  steps?: number
  restingHr?: number
}

export function aggregateHuaweiDaily(rows: HealthSyncRow[]): HuaweiDailyAggregate[] {
  const byDate = new Map<string, HuaweiDailyAggregate>()

  for (const r of rows) {
    if (!isHuawei(r.source)) continue
    const date = normalizeDate(r.date)
    if (!date) continue
    let agg = byDate.get(date)
    if (!agg) {
      agg = { date }
      byDate.set(date, agg)
    }

    const t = r.type.toLowerCase()
    if (t.includes('total') && t.includes('calor')) {
      agg.totalCalories = (agg.totalCalories ?? 0) + r.value
    } else if (t.includes('active') && t.includes('calor')) {
      agg.activeCalories = (agg.activeCalories ?? 0) + r.value
    } else if (t.includes('step')) {
      agg.steps = (agg.steps ?? 0) + r.value
    } else if (t.includes('resting') && t.includes('heart')) {
      agg.restingHr = pickMostRecent(agg.restingHr, r.value)
    }
  }

  for (const a of byDate.values()) {
    if (a.totalCalories != null) a.totalCalories = Math.round(a.totalCalories)
    if (a.activeCalories != null) a.activeCalories = Math.round(a.activeCalories)
    if (a.steps != null) a.steps = Math.round(a.steps)
    if (a.restingHr != null) a.restingHr = Math.round(a.restingHr)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function isHuawei(source: string): boolean {
  const s = source.toLowerCase()
  return s.includes('huawei') || s.includes('honor health')
}

function normalizeDate(d: string): string | null {
  const trimmed = d.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const m = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (m) {
    const [, dd, mm, yyyy] = m
    if (!dd || !mm || !yyyy) return null
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return null
}

function pickMostRecent(prev: number | undefined, next: number): number {
  return next || prev || 0
}
