import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { api, type FitnessSnapshot } from '../lib/api'

const fmt = new Intl.NumberFormat('en-US')

export function FitnessCard({ date }: { date: string }) {
  const [snap, setSnap] = useState<FitnessSnapshot | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await api.fitnessToday(date)
        if (!cancelled) setSnap(res.fitness)
      } catch {
        if (!cancelled) setSnap(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [date])

  if (snap === undefined) return null
  if (!snap) return null
  if (
    snap.steps == null &&
    snap.restingHr == null &&
    snap.activeCalories == null &&
    !snap.sleep
  )
    return null

  return (
    <Card className="flex flex-col gap-3 p-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Fitness</span>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {snap.steps != null && <Stat label="Steps" value={fmt.format(snap.steps)} />}
        {snap.activeCalories != null && (
          <Stat label="Active" value={`${fmt.format(snap.activeCalories)} kcal`} />
        )}
        {snap.restingHr != null && <Stat label="Resting HR" value={`${snap.restingHr} bpm`} />}
        {snap.sleep?.score != null && <Stat label="Sleep" value={`${snap.sleep.score}`} />}
        {snap.sleep?.totalMin != null && (
          <Stat label="Slept" value={formatMin(snap.sleep.totalMin)} />
        )}
        {snap.sleep?.hrvAvg != null && (
          <Stat label="HRV" value={`${snap.sleep.hrvAvg.toFixed(0)} ms`} />
        )}
      </div>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  )
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}
