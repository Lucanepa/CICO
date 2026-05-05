import type { Database } from '@cico/db'
import { schema } from '@cico/db'
import { getLastSync, markSyncError, markSyncSuccess } from '../../lib/sync-state.js'
import { withingsCall, type WithingsOpts } from './client.js'
import {
  ALL_MEAS_TYPES,
  WITHINGS_MEASURE_TYPES,
  type WithingsMeasureGroup,
  type WithingsMeasureResponse,
} from './types.js'

export type WithingsSyncResult = {
  measurements: number
  rangeStart: string
  rangeEnd: string
}

export async function syncWithings(
  db: Database,
  opts: WithingsOpts,
  userId: string,
  windowStart?: Date,
): Promise<WithingsSyncResult> {
  try {
    const start = windowStart ?? (await getLastSync(db, 'withings')) ?? daysAgo(60)
    const startEpoch = Math.floor(start.getTime() / 1000)
    const endEpoch = Math.floor(Date.now() / 1000)

    let inserted = 0
    let offset: number | undefined
    do {
      const body = (await withingsCall<NonNullable<WithingsMeasureResponse['body']>>(
        db,
        opts,
        '/measure',
        {
          action: 'getmeas',
          meastypes: ALL_MEAS_TYPES,
          category: 1,
          startdate: startEpoch,
          enddate: endEpoch,
          offset,
        },
      )) ?? null

      if (!body) break
      for (const grp of body.measuregrps) {
        await upsertGroup(db, userId, grp)
        inserted++
      }
      offset = body.more ? body.offset : undefined
    } while (offset !== undefined)

    await markSyncSuccess(db, 'withings')
    return {
      measurements: inserted,
      rangeStart: isoDate(new Date(startEpoch * 1000)),
      rangeEnd: isoDate(new Date(endEpoch * 1000)),
    }
  } catch (err) {
    await markSyncError(db, 'withings', err)
    throw err
  }
}

async function upsertGroup(db: Database, userId: string, grp: WithingsMeasureGroup): Promise<void> {
  if (!grp.measures.length) return
  const measuredAt = new Date(grp.date * 1000)
  const dateStr = isoDate(measuredAt)
  const timeStr = measuredAt.toISOString().slice(11, 19)

  const values: Record<number, number | undefined> = {}
  for (const m of grp.measures) {
    values[m.type] = m.value * Math.pow(10, m.unit)
  }

  await db
    .insert(schema.bodyMeasurements)
    .values({
      userId,
      date: dateStr,
      measuredAt,
      time: timeStr,
      source: 'withings',
      sourceId: String(grp.grpid),
      weightKg: values[WITHINGS_MEASURE_TYPES.weight] ?? null,
      fatPct: values[WITHINGS_MEASURE_TYPES.fatRatio] ?? null,
      leanMassKg: values[WITHINGS_MEASURE_TYPES.fatFreeMass] ?? null,
      muscleMassKg: values[WITHINGS_MEASURE_TYPES.muscleMass] ?? null,
      boneMassKg: values[WITHINGS_MEASURE_TYPES.boneMass] ?? null,
      waterPct: values[WITHINGS_MEASURE_TYPES.hydration] ?? null,
      visceralFat: values[WITHINGS_MEASURE_TYPES.visceralFat] ?? null,
      heartRate: roundOrNull(values[WITHINGS_MEASURE_TYPES.heartPulse]),
      pwv: values[WITHINGS_MEASURE_TYPES.pwv] ?? null,
      rawPayloadJsonb: grp,
    })
    .onConflictDoUpdate({
      target: [
        schema.bodyMeasurements.userId,
        schema.bodyMeasurements.source,
        schema.bodyMeasurements.sourceId,
      ],
      set: {
        date: dateStr,
        measuredAt,
        time: timeStr,
        weightKg: values[WITHINGS_MEASURE_TYPES.weight] ?? null,
        fatPct: values[WITHINGS_MEASURE_TYPES.fatRatio] ?? null,
        leanMassKg: values[WITHINGS_MEASURE_TYPES.fatFreeMass] ?? null,
        muscleMassKg: values[WITHINGS_MEASURE_TYPES.muscleMass] ?? null,
        boneMassKg: values[WITHINGS_MEASURE_TYPES.boneMass] ?? null,
        waterPct: values[WITHINGS_MEASURE_TYPES.hydration] ?? null,
        visceralFat: values[WITHINGS_MEASURE_TYPES.visceralFat] ?? null,
        heartRate: roundOrNull(values[WITHINGS_MEASURE_TYPES.heartPulse]),
        pwv: values[WITHINGS_MEASURE_TYPES.pwv] ?? null,
        rawPayloadJsonb: grp,
      },
    })
}

function roundOrNull(v: number | undefined): number | null {
  return v === undefined ? null : Math.round(v)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}
