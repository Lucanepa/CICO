import { describe, expect, it } from 'vitest'
import { computeDailyBalance } from './calculate.js'
import type { CicoInput, DailyTotalRow, FoodLogRow, WorkoutRow } from './types.js'

const dailyTotal = (overrides: Partial<DailyTotalRow> & { source: string }): DailyTotalRow => ({
  bmrCalories: null,
  activeCalories: null,
  totalCalories: null,
  steps: null,
  restingHr: null,
  ...overrides,
})

const workout = (overrides: Partial<WorkoutRow> & { id: string; source: string }): WorkoutRow => ({
  type: 'Run',
  startTime: new Date('2026-04-29T10:00:00Z'),
  endTime: new Date('2026-04-29T10:30:00Z'),
  durationMin: 30,
  calories: null,
  isPrimary: false,
  duplicateOf: null,
  ...overrides,
})

const food = (id: string, kcal: number): FoodLogRow => ({ id, kcal })

const empty = (): CicoInput => ({ dailyTotals: [], workouts: [], foodLog: [] })

describe('computeDailyBalance', () => {
  it('returns zero burn and intake when nothing is recorded', () => {
    const r = computeDailyBalance('2026-04-29', empty())
    expect(r).toMatchObject({
      intake: 0,
      burn: 0,
      net: 0,
      baseSource: 'none',
      flags: expect.arrayContaining(['no_daily_total', 'no_food_log']),
    })
  })

  it('prefers Huawei daily total over Oura', () => {
    const input: CicoInput = {
      dailyTotals: [
        dailyTotal({ source: 'huawei', totalCalories: 2400 }),
        dailyTotal({ source: 'oura', totalCalories: 2300 }),
      ],
      workouts: [],
      foodLog: [food('a', 1800)],
    }
    const r = computeDailyBalance('2026-04-29', input)
    expect(r.baseSource).toBe('huawei')
    expect(r.baseTotal).toBe(2400)
    expect(r.burn).toBe(2400)
    expect(r.intake).toBe(1800)
    expect(r.net).toBe(-600)
    expect(r.flags).toContain('huawei_used')
  })

  it('falls back to Oura when Huawei is missing', () => {
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'oura', totalCalories: 2300 })],
      workouts: [],
      foodLog: [food('a', 2000)],
    }
    const r = computeDailyBalance('2026-04-29', input)
    expect(r.baseSource).toBe('oura')
    expect(r.flags).toContain('oura_fallback')
    expect(r.burn).toBe(2300)
  })

  it('replaces base-source workouts with the primary version (Strava primary, Huawei base)', () => {
    // Huawei daily total already includes a 400 kcal workout. Strava
    // logged the same workout at 380 kcal and was picked as primary.
    // Result: subtract Huawei's 400, add Strava's 380.
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'huawei', totalCalories: 2400 })],
      workouts: [
        workout({ id: 'h1', source: 'huawei', calories: 400, isPrimary: false, duplicateOf: 's1' }),
        workout({ id: 's1', source: 'strava', calories: 380, isPrimary: true }),
      ],
      foodLog: [],
    }
    const r = computeDailyBalance('2026-04-29', input)
    expect(r.baseSourceWorkoutsSubtracted).toBe(400)
    expect(r.primaryWorkoutsAdded).toBe(380)
    expect(r.burn).toBe(2400 - 400 + 380)
  })

  it('Frontier X primary replaces Huawei base for that workout', () => {
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'huawei', totalCalories: 2500 })],
      workouts: [
        workout({ id: 'h1', source: 'huawei', calories: 350, isPrimary: false, duplicateOf: 'fx' }),
        workout({ id: 'fx', source: 'frontier_x', calories: 410, isPrimary: true }),
      ],
      foodLog: [],
    }
    const r = computeDailyBalance('2026-04-29', input)
    expect(r.burn).toBe(2500 - 350 + 410)
  })

  it('Oura-only sleep day with no workouts: just base total', () => {
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'oura', totalCalories: 2200 })],
      workouts: [],
      foodLog: [food('a', 2400)],
    }
    const r = computeDailyBalance('2026-04-29', input)
    expect(r.burn).toBe(2200)
    expect(r.intake).toBe(2400)
    expect(r.net).toBe(200)
  })

  it('watch-off: Oura workout, Huawei base — Oura kcal added on top', () => {
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'huawei', totalCalories: 2200 })],
      workouts: [workout({ id: 'o1', source: 'oura', calories: 450, isPrimary: true })],
      foodLog: [],
      watchOffSignals: [{ workoutId: 'o1', watchOff: true }],
    }
    const r = computeDailyBalance('2026-04-29', input)
    // Base: 2200, no base-source workouts to subtract, primary adds 450,
    // watch-off adds another 450 (because the watch wasn't tracking).
    expect(r.watchOffWorkoutsAdded).toBe(450)
    expect(r.burn).toBe(2200 + 450 + 450)
    expect(r.flags).toContain('watch_off_added')
  })

  it('watch-off NOT triggered when Huawei HR was elevated (watch on)', () => {
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'huawei', totalCalories: 2400 })],
      workouts: [workout({ id: 'o1', source: 'oura', calories: 450, isPrimary: true })],
      foodLog: [],
      watchOffSignals: [{ workoutId: 'o1', watchOff: false }],
    }
    const r = computeDailyBalance('2026-04-29', input)
    expect(r.watchOffWorkoutsAdded).toBe(0)
    expect(r.burn).toBe(2400 + 450)
    expect(r.flags).not.toContain('watch_off_added')
  })

  it('watch-off skipped when base is Oura (already counted by Oura)', () => {
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'oura', totalCalories: 2400 })],
      workouts: [
        workout({ id: 'o1', source: 'oura', calories: 450, isPrimary: true }),
      ],
      foodLog: [],
      watchOffSignals: [{ workoutId: 'o1', watchOff: true }],
    }
    const r = computeDailyBalance('2026-04-29', input)
    // base oura total already contains the workout; subtract the 450
    // Oura attributed and add it back as primary. Net: no change. No
    // watch-off bonus when Oura is the base.
    expect(r.baseSourceWorkoutsSubtracted).toBe(450)
    expect(r.primaryWorkoutsAdded).toBe(450)
    expect(r.watchOffWorkoutsAdded).toBe(0)
    expect(r.burn).toBe(2400)
  })

  it('intake sums food_log kcal', () => {
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'huawei', totalCalories: 2300 })],
      workouts: [],
      foodLog: [food('a', 500), food('b', 800), food('c', 200)],
    }
    expect(computeDailyBalance('2026-04-29', input).intake).toBe(1500)
  })

  it('non-primary duplicates with no base overlap are ignored', () => {
    // Edge case: if a duplicate is not from the base source AND not
    // primary, it shouldn't influence the burn.
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'huawei', totalCalories: 2400 })],
      workouts: [
        workout({ id: 's1', source: 'strava', calories: 380, isPrimary: true }),
        workout({ id: 'o1', source: 'oura', calories: 410, isPrimary: false, duplicateOf: 's1' }),
      ],
      foodLog: [],
    }
    const r = computeDailyBalance('2026-04-29', input)
    expect(r.baseSourceWorkoutsSubtracted).toBe(0)
    expect(r.primaryWorkoutsAdded).toBe(380)
    expect(r.burn).toBe(2400 + 380)
  })

  it('clamps burn at 0 (degenerate base/subtract math)', () => {
    const input: CicoInput = {
      dailyTotals: [dailyTotal({ source: 'huawei', totalCalories: 100 })],
      workouts: [
        workout({ id: 'h1', source: 'huawei', calories: 500, isPrimary: false }),
      ],
      foodLog: [],
    }
    const r = computeDailyBalance('2026-04-29', input)
    expect(r.burn).toBeGreaterThanOrEqual(0)
  })
})
