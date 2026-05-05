import type {
  CicoBreakdown,
  CicoFlag,
  CicoInput,
  DailyTotalRow,
  WorkoutRow,
} from './types.js'

/**
 * Pure function. Implements the spec:
 *
 *   baseTotal       = huawei.total_calories ?? oura.total_calories
 *   baseWithoutWO   = baseTotal - sum(workouts where source == base.source).calories
 *   primaryWorkouts = sum(workouts where is_primary).calories
 *   watchOffAdds    = sum(workouts where source == 'oura' && watchOff).calories
 *                     (only counted when base is huawei — when base is oura
 *                      they're already part of the daily total)
 *   burn            = baseWithoutWO + primaryWorkouts + watchOffAdds
 *   intake          = sum(food_log.kcal)
 *   net             = intake - burn
 *
 * Caller is responsible for making sure workouts are deduped (one
 * workout per cluster has is_primary=true). When the base source is
 * also the primary for a workout, that workout is removed from the
 * base total (to avoid double-counting) and re-added at its primary
 * value (which is the same row, so the value is preserved).
 */
export function computeDailyBalance(date: string, input: CicoInput): CicoBreakdown {
  const flags: CicoFlag[] = []

  const huawei = input.dailyTotals.find((d) => d.source === 'huawei')
  const oura = input.dailyTotals.find((d) => d.source === 'oura')
  const base = huawei ?? oura ?? null
  const measuredBmr = input.measuredBmrKcal ?? null

  if (!base) flags.push('no_daily_total')
  if (base === huawei && huawei) flags.push('huawei_used')
  if (base === oura && oura) flags.push('oura_fallback')
  if (!base && measuredBmr != null) flags.push('measured_bmr_used')

  const baseSource: CicoBreakdown['baseSource'] = base === huawei && huawei
    ? 'huawei'
    : base === oura && oura
      ? 'oura'
      : measuredBmr != null
        ? 'measured_bmr'
        : 'none'
  const baseTotal = base?.totalCalories ?? (measuredBmr ?? 0)

  const baseSourceWorkoutCalories = sumWorkoutCalories(
    input.workouts.filter((w) => baseSource !== 'none' && w.source === baseSource),
  )

  const primaryWorkoutCalories = sumWorkoutCalories(
    input.workouts.filter((w) => w.isPrimary),
  )

  const watchOffMap = new Map(
    (input.watchOffSignals ?? []).map((s) => [s.workoutId, s.watchOff]),
  )

  let watchOffAdds = 0
  if (baseSource === 'huawei') {
    for (const w of input.workouts) {
      if (w.source !== 'oura') continue
      if (!watchOffMap.get(w.id)) continue
      if (w.calories == null) continue
      watchOffAdds += w.calories
    }
    if (watchOffAdds > 0) flags.push('watch_off_added')
  }

  const burn = Math.max(
    0,
    Math.round(baseTotal - baseSourceWorkoutCalories + primaryWorkoutCalories + watchOffAdds),
  )
  const intake = input.foodLog.reduce((acc, f) => acc + f.kcal, 0)
  if (intake === 0) flags.push('no_food_log')

  return {
    date,
    intake,
    burn,
    net: intake - burn,
    baseSource,
    baseTotal,
    baseSourceWorkoutsSubtracted: Math.round(baseSourceWorkoutCalories),
    primaryWorkoutsAdded: Math.round(primaryWorkoutCalories),
    watchOffWorkoutsAdded: Math.round(watchOffAdds),
    flags,
  }
}

function sumWorkoutCalories(workouts: WorkoutRow[]): number {
  let total = 0
  for (const w of workouts) {
    if (w.calories != null) total += w.calories
  }
  return total
}

export function pickBaseDailyTotal(rows: DailyTotalRow[]): DailyTotalRow | null {
  return rows.find((d) => d.source === 'huawei') ?? rows.find((d) => d.source === 'oura') ?? null
}
