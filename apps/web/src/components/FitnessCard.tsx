import { useEffect, useState } from 'react'
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
    <section style={cardStyle}>
      <span style={label}>Fitness</span>
      <div style={statsGrid}>
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
    </section>
  )
}

function Stat({ label: l, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={statLabel}>{l}</div>
      <div style={statValue}>{value}</div>
    </div>
  )
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const label: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
  gap: 10,
}

const statLabel: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--muted)',
}

const statValue: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
}
