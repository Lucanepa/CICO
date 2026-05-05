import { useEffect, useState } from 'react'
import { api, type EnergyBalance } from '../lib/api'

const fmt = new Intl.NumberFormat('en-US')

export function EnergyBalanceChip({ date }: { date: string }) {
  const [eb, setEb] = useState<EnergyBalance | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await api.energyBalance(date, 14)
        if (!cancelled) setEb(res.energyBalance)
      } catch {
        if (!cancelled) setEb(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [date])

  if (eb === undefined) return null
  if (!eb) return null

  const isDeficit = eb.kcalPerDay > 0
  const isEven = Math.abs(eb.kcalPerDay) < 50
  const color = isEven ? 'var(--muted)' : isDeficit ? 'var(--accent)' : 'var(--warn)'
  const label = isEven
    ? 'flat'
    : isDeficit
      ? `${fmt.format(eb.kcalPerDay)} kcal/day deficit`
      : `${fmt.format(Math.abs(eb.kcalPerDay))} kcal/day surplus`
  const detail = `${eb.slopeKgPerWeek >= 0 ? '+' : '−'}${Math.abs(eb.slopeKgPerWeek).toFixed(2)} kg/wk · ${eb.samples} weigh-ins`

  return (
    <section style={{ ...cardStyle, borderColor: color }}>
      <span style={labelStyle}>Measured ({eb.windowDays}d)</span>
      <span style={{ fontSize: 16, fontWeight: 600, color }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{detail}</span>
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 12,
  marginTop: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}
