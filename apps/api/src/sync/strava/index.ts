import { and, eq } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'
import { replaceHrSamplesForWindow } from '../../lib/hr-samples.js'
import { getLastSync, markSyncError, markSyncSuccess } from '../../lib/sync-state.js'
import {
  getActivity,
  getActivityStreams,
  getActivityZones,
  stravaListActivities,
  type StravaOpts,
} from './client.js'
import type { StravaActivity } from './types.js'
import { stravaZonesToZoneMinutes } from './zones.js'

export type StravaSyncResult = {
  workouts: number
}

export type UserHrSettings = {
  age: number
  maxHrOverride?: number
}

export async function syncStrava(
  db: Database,
  opts: StravaOpts,
  userId: string,
  hr: UserHrSettings,
  windowStart?: Date,
): Promise<StravaSyncResult> {
  try {
    const after = windowStart ?? (await getLastSync(db, 'strava')) ?? daysAgo(30)
    let count = 0
    for await (const a of stravaListActivities(db, opts, after)) {
      await ingestStravaActivity(db, opts, userId, a, hr)
      count++
    }
    await markSyncSuccess(db, 'strava')
    return { workouts: count }
  } catch (err) {
    await markSyncError(db, 'strava', err)
    throw err
  }
}

export async function ingestStravaActivityById(
  db: Database,
  opts: StravaOpts,
  userId: string,
  id: number,
  hr: UserHrSettings,
) {
  const activity = await getActivity(db, opts, id)
  await ingestStravaActivity(db, opts, userId, activity, hr)
}

async function ingestStravaActivity(
  db: Database,
  opts: StravaOpts,
  userId: string,
  a: StravaActivity,
  hr: UserHrSettings,
) {
  const start = new Date(a.start_date)
  const end = new Date(start.getTime() + a.elapsed_time * 1000)
  const date = a.start_date_local.slice(0, 10)
  const durationMin = a.elapsed_time / 60

  let zoneMinutes = null
  if (a.has_heartrate) {
    try {
      const zones = await getActivityZones(db, opts, a.id)
      zoneMinutes = stravaZonesToZoneMinutes(zones, hr.age, hr.maxHrOverride)
    } catch (err) {
      console.warn(`[strava] zones fetch failed for ${a.id}:`, err)
    }

    try {
      const streams = await getActivityStreams(db, opts, a.id, ['time', 'heartrate'])
      const time = streams.time?.data ?? []
      const bpm = streams.heartrate?.data ?? []
      if (time.length > 0 && time.length === bpm.length) {
        const samples = bpm
          .map((value, i) => ({
            timestamp: new Date(start.getTime() + (time[i] ?? 0) * 1000),
            bpm: Math.round(value),
          }))
          .filter((s) => s.bpm > 30 && s.bpm < 240)
        await replaceHrSamplesForWindow(db, userId, 'strava', start, end, samples)
      }
    } catch (err) {
      console.warn(`[strava] HR streams fetch failed for ${a.id}:`, err)
    }
  }

  const sourceId = String(a.id)
  const existing = await db
    .select({ id: schema.workouts.id })
    .from(schema.workouts)
    .where(
      and(
        eq(schema.workouts.source, 'strava'),
        eq(schema.workouts.sourceId, sourceId),
        eq(schema.workouts.userId, userId),
      ),
    )
    .limit(1)

  const values = {
    userId,
    date,
    startTime: start,
    endTime: end,
    source: 'strava',
    sourceId,
    type: a.sport_type ?? a.type,
    durationMin,
    calories: a.calories != null ? Math.round(a.calories) : null,
    avgHr: a.average_heartrate != null ? Math.round(a.average_heartrate) : null,
    maxHr: a.max_heartrate != null ? Math.round(a.max_heartrate) : null,
    zoneMinutesJsonb: zoneMinutes,
    isPrimary: false,
    duplicateOf: null,
    rawPayloadJsonb: a,
  }

  if (existing[0]) {
    await db.update(schema.workouts).set(values).where(eq(schema.workouts.id, existing[0].id))
  } else {
    await db.insert(schema.workouts).values(values)
  }
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}
