import { and, asc, eq, gte, isNotNull, lte } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'

const KCAL_PER_KG_FAT = 7700
const MIN_SAMPLES = 4
const DEFAULT_WINDOW_DAYS = 14

export type EnergyBalance = {
  windowDays: number
  samples: number
  firstWeightKg: number
  lastWeightKg: number
  slopeKgPerDay: number
  slopeKgPerWeek: number
  kcalPerDay: number
}

export async function computeEnergyBalance(
  db: Database,
  userId: string,
  endDate: string,
  windowDays = DEFAULT_WINDOW_DAYS,
): Promise<EnergyBalance | null> {
  const end = new Date(`${endDate}T00:00:00Z`)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - windowDays)
  const startDate = start.toISOString().slice(0, 10)

  const rows = await db
    .select({
      date: schema.bodyMeasurements.date,
      measuredAt: schema.bodyMeasurements.measuredAt,
      weightKg: schema.bodyMeasurements.weightKg,
    })
    .from(schema.bodyMeasurements)
    .where(
      and(
        eq(schema.bodyMeasurements.userId, userId),
        isNotNull(schema.bodyMeasurements.weightKg),
        gte(schema.bodyMeasurements.date, startDate),
        lte(schema.bodyMeasurements.date, endDate),
      ),
    )
    .orderBy(asc(schema.bodyMeasurements.measuredAt))

  if (rows.length < MIN_SAMPLES) return null

  // Take one reading per day (last) to limit noise from multi-weighings.
  const byDate = new Map<string, { tMs: number; kg: number }>()
  for (const r of rows) {
    if (r.weightKg == null) continue
    const tMs = r.measuredAt
      ? new Date(r.measuredAt).getTime()
      : new Date(`${r.date}T12:00:00Z`).getTime()
    byDate.set(r.date, { tMs, kg: r.weightKg })
  }
  const points = [...byDate.values()].sort((a, b) => a.tMs - b.tMs)
  if (points.length < MIN_SAMPLES) return null

  const t0 = points[0]!.tMs
  const xs = points.map((p) => (p.tMs - t0) / 86_400_000)
  const ys = points.map((p) => p.kg)

  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY)
    den += (xs[i]! - meanX) ** 2
  }
  const slopeKgPerDay = den === 0 ? 0 : num / den

  return {
    windowDays,
    samples: n,
    firstWeightKg: points[0]!.kg,
    lastWeightKg: points[n - 1]!.kg,
    slopeKgPerDay,
    slopeKgPerWeek: slopeKgPerDay * 7,
    kcalPerDay: Math.round(-slopeKgPerDay * KCAL_PER_KG_FAT),
  }
}
