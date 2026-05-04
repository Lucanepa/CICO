import { describe, expect, it } from 'vitest'
import { clusterByOverlap, overlapRatio } from './overlap.js'
import { decidePrimaries } from './primary.js'
import { DEFAULT_DEDUP_OPTIONS, type WorkoutForDedup } from './types.js'

const baseWorkout = (
  id: string,
  source: string,
  startMin: number,
  durationMin: number,
  overrides: Partial<WorkoutForDedup> = {},
): WorkoutForDedup => {
  const start = new Date(`2026-04-29T${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}:00Z`)
  const end = new Date(start.getTime() + durationMin * 60_000)
  return {
    id,
    userId: 'user-1',
    date: '2026-04-29',
    startTime: start,
    endTime: end,
    source,
    type: 'Run',
    durationMin,
    calories: null,
    isPrimary: false,
    duplicateOf: null,
    ...overrides,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

describe('overlapRatio', () => {
  it('returns 1.0 for identical windows', () => {
    const a = baseWorkout('a', 'oura', 600, 60)
    const b = baseWorkout('b', 'strava', 600, 60)
    expect(overlapRatio(a, b)).toBe(1)
  })

  it('returns 0 for disjoint windows', () => {
    const a = baseWorkout('a', 'oura', 600, 30)
    const b = baseWorkout('b', 'strava', 700, 30)
    expect(overlapRatio(a, b)).toBe(0)
  })

  it('measures overlap as fraction of shorter window', () => {
    const a = baseWorkout('a', 'oura', 600, 60)
    const b = baseWorkout('b', 'strava', 615, 30)
    expect(overlapRatio(a, b)).toBeCloseTo(1.0)
  })
})

describe('clusterByOverlap', () => {
  it('groups overlapping workouts and isolates non-overlapping ones', () => {
    const ws = [
      baseWorkout('a', 'oura', 600, 60),
      baseWorkout('b', 'strava', 605, 50),
      baseWorkout('c', 'oura', 800, 30),
    ]
    const groups = clusterByOverlap(ws, 0.5)
    expect(groups).toHaveLength(2)
    const big = groups.find((g) => g.length === 2)!
    expect(big.map((w) => w.id).sort()).toEqual(['a', 'b'])
    const lonely = groups.find((g) => g.length === 1)!
    expect(lonely[0]?.id).toBe('c')
  })
})

describe('decidePrimaries', () => {
  it('prefers Strava over Oura by default priority', () => {
    const ws = [
      baseWorkout('o', 'oura', 600, 60, { calories: 400 }),
      baseWorkout('s', 'strava', 605, 50, { calories: 380 }),
    ]
    const decisions = decidePrimaries(ws, DEFAULT_DEDUP_OPTIONS)
    expect(decisions).toHaveLength(1)
    expect(decisions[0]?.primaryId).toBe('s')
    expect(decisions[0]?.duplicateIds).toEqual(['o'])
  })

  it('respects manual pin even against priority', () => {
    const ws = [
      baseWorkout('o', 'oura', 600, 60, { calories: 400, isPrimary: true }),
      baseWorkout('s', 'strava', 605, 50, { calories: 380 }),
    ]
    const decisions = decidePrimaries(ws, DEFAULT_DEDUP_OPTIONS)
    expect(decisions[0]?.primaryId).toBe('o')
    expect(decisions[0]?.duplicateIds).toEqual(['s'])
  })

  it('produces one decision per cluster', () => {
    const ws = [
      baseWorkout('a', 'oura', 600, 60),
      baseWorkout('b', 'strava', 605, 50),
      baseWorkout('c', 'oura', 800, 30),
    ]
    const decisions = decidePrimaries(ws, DEFAULT_DEDUP_OPTIONS)
    expect(decisions).toHaveLength(2)
  })
})
