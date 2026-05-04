export type HrZone = 'z0' | 'z1' | 'z2' | 'z3' | 'z4' | 'z5'

export type ZoneMinutes = Record<HrZone, number>

export function defaultMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age)
}

const ZONE_BOUNDS: Array<[HrZone, number]> = [
  ['z0', 0.49],
  ['z1', 0.59],
  ['z2', 0.69],
  ['z3', 0.79],
  ['z4', 0.89],
  ['z5', 1.0],
]

export function zoneForBpm(bpm: number, maxHr: number): HrZone {
  const pct = bpm / maxHr
  for (const [zone, upper] of ZONE_BOUNDS) {
    if (pct <= upper) return zone
  }
  return 'z5'
}
