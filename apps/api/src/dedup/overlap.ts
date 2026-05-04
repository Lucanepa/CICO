import type { WorkoutForDedup } from './types.js'

export function overlapRatio(a: WorkoutForDedup, b: WorkoutForDedup): number {
  const start = Math.max(a.startTime.getTime(), b.startTime.getTime())
  const end = Math.min(a.endTime.getTime(), b.endTime.getTime())
  if (end <= start) return 0
  const overlapMs = end - start
  const minDurationMs = Math.min(
    a.endTime.getTime() - a.startTime.getTime(),
    b.endTime.getTime() - b.startTime.getTime(),
  )
  if (minDurationMs <= 0) return 0
  return overlapMs / minDurationMs
}

export function clusterByOverlap(
  workouts: WorkoutForDedup[],
  minOverlapRatio: number,
): WorkoutForDedup[][] {
  const sorted = [...workouts].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x)
    if (!p || p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  const union = (x: string, y: string) => {
    const rx = find(x)
    const ry = find(y)
    if (rx !== ry) parent.set(rx, ry)
  }
  for (const w of sorted) parent.set(w.id, w.id)

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]
    if (!a) continue
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]
      if (!b) break
      if (b.startTime.getTime() >= a.endTime.getTime()) break
      if (overlapRatio(a, b) >= minOverlapRatio) union(a.id, b.id)
    }
  }

  const groups = new Map<string, WorkoutForDedup[]>()
  for (const w of sorted) {
    const root = find(w.id)
    const arr = groups.get(root) ?? []
    arr.push(w)
    groups.set(root, arr)
  }
  return [...groups.values()]
}
