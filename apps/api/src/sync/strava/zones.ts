import type { ZoneMinutes } from '@cico/shared'
import { defaultMaxHr } from '@cico/shared'
import type { StravaActivityZones } from './types.js'

export function stravaZonesToZoneMinutes(
  zones: StravaActivityZones,
  age: number,
  maxHrOverride?: number,
): ZoneMinutes | null {
  const hr = zones.find((z) => z.type === 'heartrate')
  if (!hr) return null

  const maxHr = maxHrOverride ?? defaultMaxHr(age)
  const out: ZoneMinutes = { z0: 0, z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }

  for (const b of hr.distribution_buckets) {
    const midPct = ((b.min + b.max) / 2) / maxHr
    const minutes = b.time / 60
    if (midPct <= 0.49) out.z0 += minutes
    else if (midPct <= 0.59) out.z1 += minutes
    else if (midPct <= 0.69) out.z2 += minutes
    else if (midPct <= 0.79) out.z3 += minutes
    else if (midPct <= 0.89) out.z4 += minutes
    else out.z5 += minutes
  }
  for (const k of Object.keys(out) as Array<keyof ZoneMinutes>) {
    out[k] = Math.round(out[k])
  }
  return out
}
