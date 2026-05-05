import type { Database } from '@cico/db'
import { schema } from '@cico/db'
import { getLastSync, markSyncError, markSyncSuccess } from '../../lib/sync-state.js'
import { withingsCall, type WithingsOpts } from './client.js'
import {
  ALL_MEAS_TYPES,
  WITHINGS_MEASURE_TYPES,
  type WithingsEcgSession,
  type WithingsHeartListResponse,
  type WithingsMeasureGroup,
  type WithingsMeasureResponse,
} from './types.js'

const AFIB_LABELS: Record<number, string> = {
  0: 'no_signal',
  1: 'no_afib',
  2: 'afib',
  3: 'inconclusive',
}

export type WithingsSyncResult = {
  measurements: number
  ecgRecordings: number
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

    let ecgRecordings = 0
    try {
      ecgRecordings = await syncEcg(db, opts, userId, startEpoch, endEpoch)
    } catch (err) {
      // Don't fail the whole sync if ECG endpoint is unavailable (scope or device).
      console.warn('[withings] ecg sync failed:', (err as Error).message)
    }

    await markSyncSuccess(db, 'withings')
    return {
      measurements: inserted,
      ecgRecordings,
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

  const row = {
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
    systolicBp: roundOrNull(values[WITHINGS_MEASURE_TYPES.systolicBp]),
    diastolicBp: roundOrNull(values[WITHINGS_MEASURE_TYPES.diastolicBp]),
    spo2Pct: pctOrNull(values[WITHINGS_MEASURE_TYPES.spo2]),
    vascularAge: roundOrNull(values[WITHINGS_MEASURE_TYPES.vascularAge]),
    nerveHealthScore: values[WITHINGS_MEASURE_TYPES.nerveHealth] ?? null,
    extracellularWaterKg: values[WITHINGS_MEASURE_TYPES.extracellularWater] ?? null,
    intracellularWaterKg: values[WITHINGS_MEASURE_TYPES.intracellularWater] ?? null,
    rawPayloadJsonb: grp,
  }

  await db
    .insert(schema.bodyMeasurements)
    .values(row)
    .onConflictDoUpdate({
      target: [
        schema.bodyMeasurements.userId,
        schema.bodyMeasurements.source,
        schema.bodyMeasurements.sourceId,
      ],
      set: row,
    })
}

async function syncEcg(
  db: Database,
  opts: WithingsOpts,
  userId: string,
  startEpoch: number,
  endEpoch: number,
): Promise<number> {
  let inserted = 0
  let offset: number | undefined
  do {
    const body = (await withingsCall<NonNullable<WithingsHeartListResponse['body']>>(
      db,
      opts,
      '/v2/heart',
      {
        action: 'list',
        startdate: startEpoch,
        enddate: endEpoch,
        offset,
      },
    )) ?? null
    if (!body) break

    for (const s of body.series) {
      if (!s.ecg?.signalid) continue
      await upsertEcg(db, userId, s)
      inserted++
    }
    offset = body.more ? body.offset : undefined
  } while (offset !== undefined)
  return inserted
}

async function upsertEcg(db: Database, userId: string, s: WithingsEcgSession): Promise<void> {
  const measuredAt = new Date(s.timestamp * 1000)
  const sourceId = String(s.ecg?.signalid)
  const afib = s.ecg?.afib_classification ?? s.ecg?.afib
  const row = {
    userId,
    source: 'withings',
    sourceId,
    date: isoDate(measuredAt),
    measuredAt,
    deviceModel: s.device_model ?? (s.model != null ? String(s.model) : null),
    afibClassification: afib != null ? AFIB_LABELS[afib] ?? String(afib) : null,
    averageHeartRate: s.heart_rate ?? null,
    qrsMs: s.qrs ?? null,
    prMs: s.pr ?? null,
    qtMs: s.qt ?? null,
    qtcMs: s.qtc ?? null,
    durationSec: s.duration ?? null,
    samplingRateHz: s.sampling_frequency ?? null,
    leadCount: null,
    signalUrl: s.signal_url ?? null,
    signalJsonb: null,
    rawPayloadJsonb: s,
  }
  await db
    .insert(schema.ecgRecordings)
    .values(row)
    .onConflictDoUpdate({
      target: [
        schema.ecgRecordings.userId,
        schema.ecgRecordings.source,
        schema.ecgRecordings.sourceId,
      ],
      set: row,
    })
}

function roundOrNull(v: number | undefined): number | null {
  return v === undefined ? null : Math.round(v)
}

function pctOrNull(v: number | undefined): number | null {
  if (v === undefined) return null
  // Withings returns SpO2 as fraction in some firmware (0-1), as percent in others.
  return v <= 1 ? v * 100 : v
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}
