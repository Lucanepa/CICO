import { useCallback, useEffect, useState } from 'react'
import { BodyCard } from '../components/BodyCard'
import { Donut } from '../components/Donut'
import { EnergyBalanceChip } from '../components/EnergyBalanceChip'
import { FitnessCard } from '../components/FitnessCard'
import { api, localIsoDate, type CicoBreakdown } from '../lib/api'

const fmt = new Intl.NumberFormat('en-US')

export function Today() {
  const [date] = useState<string>(() => localIsoDate())
  const [breakdown, setBreakdown] = useState<CicoBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.today(date)
      setBreakdown(res.breakdown)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  const refreshNow = async () => {
    setRefreshing(true)
    try {
      await api.refresh()
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>loading…</div>
  if (error) return <div style={{ padding: 24, color: 'var(--danger)' }}>error: {error}</div>
  if (!breakdown) return null

  const net = breakdown.net
  const netLabel = net === 0 ? 'even' : net > 0 ? 'surplus' : 'deficit'
  const netColor = net === 0 ? 'var(--text)' : net > 0 ? 'var(--warn)' : 'var(--accent)'

  return (
    <main style={{ padding: '24px 20px 96px', maxWidth: 480, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{prettyDate(breakdown.date)}</div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Today</h1>
        </div>
        <button onClick={refreshNow} disabled={refreshing}>
          {refreshing ? 'syncing…' : 'sync'}
        </button>
      </header>

      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 24,
        }}
      >
        <div style={{ position: 'relative' }}>
          <Donut intake={breakdown.intake} burn={breakdown.burn} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>
              net
            </span>
            <span style={{ fontSize: 44, fontWeight: 700, color: netColor }}>
              {Math.abs(net) > 0 ? `${net > 0 ? '+' : '−'}${fmt.format(Math.abs(net))}` : '0'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{netLabel}</span>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24 }}>
        <Stat label="intake" value={breakdown.intake} dot="var(--intake)" suffix="kcal" />
        <Stat label="burn" value={breakdown.burn} dot="var(--burn)" suffix="kcal" />
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 14, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          burn breakdown
        </h2>
        <div style={cardStyle}>
          <Row label={`base — ${breakdown.baseSource}`} value={breakdown.baseTotal} />
          {breakdown.baseSourceWorkoutsSubtracted > 0 && (
            <Row
              label="− base workouts"
              value={-breakdown.baseSourceWorkoutsSubtracted}
              muted
            />
          )}
          {breakdown.primaryWorkoutsAdded > 0 && (
            <Row label="+ primary workouts" value={breakdown.primaryWorkoutsAdded} />
          )}
          {breakdown.watchOffWorkoutsAdded > 0 && (
            <Row
              label="+ watch-off (Oura)"
              value={breakdown.watchOffWorkoutsAdded}
              accent="var(--warn)"
            />
          )}
          <Row label="total" value={breakdown.burn} bold />
        </div>
      </section>

      <BodyCard />
      <EnergyBalanceChip date={breakdown.date} />
      <FitnessCard date={breakdown.date} />

      {breakdown.flags.length > 0 && (
        <section style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {breakdown.flags.map((f) => (
              <span key={f} style={tagStyle}>
                {f.replaceAll('_', ' ')}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const tagStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '4px 8px',
  borderRadius: 999,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--muted)',
}

function Stat({
  label,
  value,
  dot,
  suffix,
}: {
  label: string
  value: number
  dot: string
  suffix: string
}) {
  return (
    <div style={cardStyle}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        <span
          style={{ width: 8, height: 8, borderRadius: 4, background: dot, display: 'inline-block' }}
        />
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 600 }}>
        {fmt.format(value)} <span style={{ fontSize: 12, color: 'var(--muted)' }}>{suffix}</span>
      </span>
    </div>
  )
}

function Row({
  label,
  value,
  muted = false,
  bold = false,
  accent,
}: {
  label: string
  value: number
  muted?: boolean
  bold?: boolean
  accent?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        color: muted ? 'var(--muted)' : accent ?? 'var(--text)',
        fontWeight: bold ? 600 : 400,
        borderTop: bold ? '1px solid var(--border)' : 'none',
        paddingTop: bold ? 8 : 0,
      }}
    >
      <span>{label}</span>
      <span>
        {value < 0 ? '−' : ''}
        {fmt.format(Math.abs(value))} kcal
      </span>
    </div>
  )
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(d)
}
