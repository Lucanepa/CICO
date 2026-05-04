import { and, eq, sum } from 'drizzle-orm'
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

  const input: CicoInput = { dailyTotals, workouts, foodLog, watchOffSignals }
  return computeDailyBalance(date, input)
}

export async function loadIntake(db: Database, userId: string, date: string): Promise<number> {
  const result = await db
    .select({ total: sum(schema.foodLog.kcal) })
    .from(schema.foodLog)
    .where(and(eq(schema.foodLog.userId, userId), eq(schema.foodLog.date, date)))
  return Number(result[0]?.total ?? 0)
}
