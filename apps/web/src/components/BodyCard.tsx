import { useCallback, useEffect, useState } from 'react'
import { api, type BodyMeasurement } from '../lib/api'
import { LogBodySheet } from './LogBodySheet'

const fmt1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const fmt0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function BodyCard() {
  const [m, setM] = useState<BodyMeasurement | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.bodyLatest()
      setM(res.measurement)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (m === undefined) return null
  if (error) return null

  const measured = m?.measuredAt ? new Date(m.measuredAt) : null
  const ago = measured ? humanAgo(measured) : null

  return (
    <section style={cardStyle}>
      <div style={headerRow}>
        <span style={label}>Body</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {m && (
            <span style={badge}>
              {m.source}
              {ago ? ` · ${ago}` : ''}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            style={{ padding: '4px 10px' }}
          >
            log
          </button>
        </div>
      </div>

      {!m && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          No measurements yet — tap "log" to add one.
        </div>
      )}

      {m && (
        <div style={statsGrid}>
          {m.weightKg != null && <Stat label="Weight" value={`${fmt1.format(m.weightKg)} kg`} />}
          {m.fatPct != null && <Stat label="Fat" value={`${fmt1.format(m.fatPct)} %`} />}
          {m.muscleMassKg != null && (
            <Stat label="Muscle" value={`${fmt1.format(m.muscleMassKg)} kg`} />
          )}
          {m.skeletalMusclePct != null && m.muscleMassKg == null && (
            <Stat label="Skeletal muscle" value={`${fmt1.format(m.skeletalMusclePct)} %`} />
          )}
          {m.waterPct != null && <Stat label="Water" value={`${fmt1.format(m.waterPct)} %`} />}
          {m.visceralFat != null && (
            <Stat label="Visceral" value={fmt1.format(m.visceralFat)} />
          )}
          {m.bmrKcal != null && <Stat label="BMR" value={`${fmt0.format(m.bmrKcal)} kcal`} />}
        </div>
      )}

      <LogBodySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={() => {
          void load()
        }}
      />
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

function humanAgo(d: Date): string {
  const ms = Date.now() - d.getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
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

const headerRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const label: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const badge: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 8px',
  borderRadius: 999,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--muted)',
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
