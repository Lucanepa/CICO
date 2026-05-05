import { and, desc, eq, gte, isNotNull, lte, sum } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'
import { detectWatchOff } from '../dedup/watch-off.js'
import { computeDailyBalance } from './calculate.js'
import type { CicoBreakdown, CicoInput, FoodLogRow, WorkoutRow } from './types.js'

export async function loadAndComputeDay(
  db: Database,
  userId: string,
  date: string,
): Promise<CicoBreakdown> {
  const dailyTotals = await db
    .select({
      source: schema.dailyTotals.source,
      bmrCalories: schema.dailyTotals.bmrCalories,
      activeCalories: schema.dailyTotals.activeCalories,
      totalCalories: schema.dailyTotals.totalCalories,
      steps: schema.dailyTotals.steps,
      restingHr: schema.dailyTotals.restingHr,
    })
    .from(schema.dailyTotals)
    .where(and(eq(schema.dailyTotals.userId, userId), eq(schema.dailyTotals.date, date)))

  const workouts: WorkoutRow[] = await db
    .select({
      id: schema.workouts.id,
      source: schema.workouts.source,
      type: schema.workouts.type,
      startTime: schema.workouts.startTime,
      endTime: schema.workouts.endTime,
      durationMin: schema.workouts.durationMin,
      calories: schema.workouts.calories,
      isPrimary: schema.workouts.isPrimary,
      duplicateOf: schema.workouts.duplicateOf,
    })
    .from(schema.workouts)
    .where(and(eq(schema.workouts.userId, userId), eq(schema.workouts.date, date)))

  const foodLog: FoodLogRow[] = await db
    .select({ id: schema.foodLog.id, kcal: schema.foodLog.kcal })
    .from(schema.foodLog)
    .where(and(eq(schema.foodLog.userId, userId), eq(schema.foodLog.date, date)))

  const huawei = dailyTotals.find((d) => d.source === 'huawei')
  const watchOffSignals: { workoutId: string; watchOff: boolean }[] = []
  if (huawei && huawei.restingHr != null) {
    for (const w of workouts) {
      if (w.source !== 'oura') continue
      const sig = await detectWatchOff(db, userId, w, huawei.restingHr)
      watchOffSignals.push({ workoutId: w.id, watchOff: sig.watchOff })
    }
  }

  const recentBmrCutoff = new Date(date)
  recentBmrCutoff.setUTCDate(recentBmrCutoff.getUTCDate() - 30)
  const recentBmrCutoffStr = recentBmrCutoff.toISOString().slice(0, 10)
  const bmrRow = await db
    .select({ bmrKcal: schema.bodyMeasurements.bmrKcal })
    .from(schema.bodyMeasurements)
    .where(
      and(
        eq(schema.bodyMeasurements.userId, userId),
        isNotNull(schema.bodyMeasurements.bmrKcal),
        gte(schema.bodyMeasurements.date, recentBmrCutoffStr),
        lte(schema.bodyMeasurements.date, date),
      ),
    )
    .orderBy(desc(schema.bodyMeasurements.date), desc(schema.bodyMeasurements.measuredAt))
    .limit(1)
  const measuredBmrKcal = bmrRow[0]?.bmrKcal ?? null

  const input: CicoInput = { dailyTotals, workouts, foodLog, watchOffSignals, measuredBmrKcal }
  return computeDailyBalance(date, input)
}

export async function loadIntake(db: Database, userId: string, date: string): Promise<number> {
  const result = await db
    .select({ total: sum(schema.foodLog.kcal) })
    .from(schema.foodLog)
    .where(and(eq(schema.foodLog.userId, userId), eq(schema.foodLog.date, date)))
  return Number(result[0]?.total ?? 0)
}
