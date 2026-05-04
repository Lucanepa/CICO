import { and, eq } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'
import { markSyncError, markSyncSuccess, getLastSync } from '../../lib/sync-state.js'
import { ouraPaginate, type OuraOpts } from './client.js'
import type {
  OuraDailyActivity,
  OuraDailySleep,
  OuraSleepSession,
  OuraWorkout,
} from './types.js'

export type OuraSyncResult = {
  dailyTotals: number
  sleep: number
  workouts: number
}

export async function syncOura(
  db: Database,
  opts: OuraOpts,
  userId: string,
  windowStart?: Date,
): Promise<OuraSyncResult> {
  try {
    const start = windowStart ?? (await getLastSync(db, 'oura')) ?? daysAgo(14)
    const startDate = isoDate(start)
    const endDate = isoDate(new Date())

    const dailyTotals = await syncDailyActivity(db, opts, userId, startDate, endDate)
    const sleep = await syncSleep(db, opts, userId, startDate, endDate)
    const workouts = await syncWorkouts(db, opts, userId, startDate, endDate)

    await markSyncSuccess(db, 'oura')
    return { dailyTotals, sleep, workouts }
  } catch (err) {
    await markSyncError(db, 'oura', err)
    throw err
  }
}

async function syncDailyActivity(
  db: Database,
  opts: OuraOpts,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  let count = 0
  for await (const a of ouraPaginate<OuraDailyActivity>(db, opts, '/daily_activity', {
    start_date: startDate,
    end_date: endDate,
  })) {
    await db
      .insert(schema.dailyTotals)
      .values({
        userId,
        date: a.day,
        source: 'oura',
        bmrCalories: a.total_calories - a.active_calories,
        activeCalories: a.active_calories,
        totalCalories: a.total_calories,
        steps: a.steps,
        restingHr: a.resting_heart_rate ?? null,
      })
      .onConflictDoUpdate({
        target: [schema.dailyTotals.userId, schema.dailyTotals.date, schema.dailyTotals.source],
        set: {
          bmrCalories: a.total_calories - a.active_calories,
          activeCalories: a.active_calories,
          totalCalories: a.total_calories,
          steps: a.steps,
          restingHr: a.resting_heart_rate ?? null,
        },
      })
    count++
  }
  return count
}

async function syncSleep(
  db: Database,
  opts: OuraOpts,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const sessions: OuraSleepSession[] = []
  for await (const s of ouraPaginate<OuraSleepSession>(db, opts, '/sleep', {
    start_date: startDate,
    end_date: endDate,
  })) {
    sessions.push(s)
  }

  const scores = new Map<string, number>()
  for await (const ds of ouraPaginate<OuraDailySleep>(db, opts, '/daily_sleep', {
    start_date: startDate,
    end_date: endDate,
  })) {
    if (ds.score != null) scores.set(ds.day, ds.score)
  }

  let count = 0
  for (const s of sessions) {
    const existing = await db
      .select({ id: schema.sleepSessions.id })
      .from(schema.sleepSessions)
      .where(
        and(
          eq(schema.sleepSessions.userId, userId),
          eq(schema.sleepSessions.date, s.day),
          eq(schema.sleepSessions.source, 'oura'),
        ),
      )
      .limit(1)

    const values = {
      userId,
      date: s.day,
      source: 'oura',
      totalMin: s.total_sleep_duration != null ? Math.round(s.total_sleep_duration / 60) : null,
      deepMin: s.deep_sleep_duration != null ? Math.round(s.deep_sleep_duration / 60) : null,
      remMin: s.rem_sleep_duration != null ? Math.round(s.rem_sleep_duration / 60) : null,
      lightMin: s.light_sleep_duration != null ? Math.round(s.light_sleep_duration / 60) : null,
      efficiency: s.efficiency ?? null,
      hrvAvg: s.average_hrv ?? null,
      score: scores.get(s.day) ?? null,
      rawPayloadJsonb: s,
    }

    if (existing[0]) {
      await db
        .update(schema.sleepSessions)
        .set(values)
        .where(eq(schema.sleepSessions.id, existing[0].id))
    } else {
      await db.insert(schema.sleepSessions).values(values)
    }
    count++
  }
  return count
}

async function syncWorkouts(
  db: Database,
  opts: OuraOpts,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  let count = 0
  for await (const w of ouraPaginate<OuraWorkout>(db, opts, '/workout', {
    start_date: startDate,
    end_date: endDate,
  })) {
    const start = new Date(w.start_datetime)
    const end = new Date(w.end_datetime)
    const durationMin = (end.getTime() - start.getTime()) / 60000

    const existing = await db
      .select({ id: schema.workouts.id })
      .from(schema.workouts)
      .where(
        and(
          eq(schema.workouts.source, 'oura'),
          eq(schema.workouts.sourceId, w.id),
          eq(schema.workouts.userId, userId),
        ),
      )
      .limit(1)

    const values = {
      userId,
      date: w.day,
      startTime: start,
      endTime: end,
      source: 'oura',
      sourceId: w.id,
      type: w.activity,
      durationMin,
      calories: w.calories != null ? Math.round(w.calories) : null,
      avgHr: null,
      maxHr: null,
      zoneMinutesJsonb: null,
      isPrimary: false,
      duplicateOf: null,
      rawPayloadJsonb: w,
    }

    if (existing[0]) {
      await db.update(schema.workouts).set(values).where(eq(schema.workouts.id, existing[0].id))
    } else {
      await db.insert(schema.workouts).values(values)
    }
    count++
  }
  return count
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}
