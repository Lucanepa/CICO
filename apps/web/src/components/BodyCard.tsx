import { useCallback, useEffect, useState } from 'react'
import { api, type BodyMeasurement } from '../lib/api'
import { LogBodySheet } from './LogBodySheet'

const fmt1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const fmt0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

type SeriesEntry = BodyMeasurement & { id?: string }

export function BodyCard() {
  const [series, setSeries] = useState<SeriesEntry[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.bodySeries(60)
      setSeries(res.series)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (series === undefined) return null
  if (error) return null

  const m = series.length > 0 ? series[series.length - 1]! : null
  const measured = m?.measuredAt ? new Date(m.measuredAt) : null
  const ago = measured ? humanAgo(measured) : null

  const prior = m ? findPrior(series, m) : null

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
          {m.weightKg != null && (
            <Stat
              label="Weight"
              value={`${fmt1.format(m.weightKg)} kg`}
              delta={diff(m.weightKg, prior?.weightKg)}
              suffix="kg"
              betterDirection="down"
            />
          )}
          {m.fatPct != null && (
            <Stat
              label="Fat"
              value={`${fmt1.format(m.fatPct)} %`}
              delta={diff(m.fatPct, prior?.fatPct)}
              suffix="%"
              betterDirection="down"
            />
          )}
          {m.muscleMassKg != null && (
            <Stat
              label="Muscle"
              value={`${fmt1.format(m.muscleMassKg)} kg`}
              delta={diff(m.muscleMassKg, prior?.muscleMassKg)}
              suffix="kg"
              betterDirection="up"
            />
          )}
          {m.skeletalMusclePct != null && m.muscleMassKg == null && (
            <Stat
              label="Skeletal muscle"
              value={`${fmt1.format(m.skeletalMusclePct)} %`}
              delta={diff(m.skeletalMusclePct, prior?.skeletalMusclePct)}
              suffix="%"
              betterDirection="up"
            />
          )}
          {m.waterPct != null && <Stat label="Water" value={`${fmt1.format(m.waterPct)} %`} />}
          {m.visceralFat != null && (
            <Stat
              label="Visceral"
              value={fmt1.format(m.visceralFat)}
              delta={diff(m.visceralFat, prior?.visceralFat)}
              betterDirection="down"
            />
          )}
          {m.bmrKcal != null && <Stat label="BMR" value={`${fmt0.format(m.bmrKcal)} kcal`} />}
        </div>
      )}

      {m?.source === 'manual' && m.id && (
        <button
          type="button"
          onClick={async () => {
            if (!confirm('Delete this manual entry?')) return
            await api.deleteBodyLog(m.id!)
            void load()
          }}
          style={{
            alignSelf: 'flex-end',
            padding: '4px 10px',
            fontSize: 11,
            color: 'var(--muted)',
            background: 'transparent',
            border: '1px solid var(--border)',
          }}
        >
          delete entry
        </button>
      )}

      <LogBodySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        prefill={m ?? undefined}
        onSaved={() => {
          void load()
        }}
      />
    </section>
  )
}

function diff(now: number | null | undefined, prior: number | null | undefined): number | null {
  if (now == null || prior == null) return null
  const d = now - prior
  return Math.abs(d) < 0.01 ? null : d
}

function findPrior(series: SeriesEntry[], current: SeriesEntry): SeriesEntry | null {
  for (let i = series.length - 2; i >= 0; i--) {
    const e = series[i]!
    if (e.date !== current.date) return e
  }
  return null
}

function Stat({
  label: l,
  value,
  delta,
  suffix,
  betterDirection,
}: {
  label: string
  value: string
  delta?: number | null
  suffix?: string
  betterDirection?: 'up' | 'down'
}) {
  const sign = delta == null ? '' : delta > 0 ? '+' : '−'
  const isImprovement =
    delta != null && betterDirection
      ? betterDirection === 'down'
        ? delta < 0
        : delta > 0
      : null
  const deltaColor =
    isImprovement === true
      ? 'var(--accent)'
      : isImprovement === false
        ? 'var(--warn)'
        : 'var(--muted)'

  return (
    <div>
      <div style={statLabel}>{l}</div>
      <div style={statValue}>{value}</div>
      {delta != null && (
        <div style={{ fontSize: 11, color: deltaColor, marginTop: 2 }}>
          {sign}
          {fmt1.format(Math.abs(delta))}
          {suffix ? ` ${suffix}` : ''}
        </div>
      )}
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
