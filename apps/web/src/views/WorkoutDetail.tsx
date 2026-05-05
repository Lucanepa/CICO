import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HrCurve } from '../components/HrCurve'
import { SourceBadge } from '../components/SourceBadge'
import { ZoneBar } from '../components/ZoneBar'
import { api, type Workout } from '../lib/api'

const fmt = new Intl.NumberFormat('en-US')

export function WorkoutDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<{
    workout: Workout
    samples: Array<{ timestamp: string; bpm: number; source: string }>
    duplicates: Workout[]
    maxHr: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await api.workout(id)
      setData({
        workout: res.workout,
        samples: res.samples,
        duplicates: res.duplicates,
        maxHr: res.maxHr,
      })
    } catch (err) {
      setError((err as Error).message)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <div style={{ padding: 24, color: 'var(--danger)' }}>error: {error}</div>
  if (!data) return <div style={{ padding: 24 }}>loading…</div>

  const { workout: w, samples, duplicates, maxHr } = data

  return (
    <main style={{ padding: '24px 20px 96px', maxWidth: 480, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 16, padding: '6px 10px', fontSize: 12 }}>
        ← back
      </button>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>{w.type}</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {timeRange(w.startTime, w.endTime)} · {Math.round(w.durationMin)} min
          </div>
        </div>
        <SourceBadge source={w.source} />
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginTop: 16,
        }}
      >
        <Stat label="kcal" value={w.calories ?? '—'} />
        <Stat label="avg HR" value={w.avgHr ?? '—'} suffix="bpm" />
        <Stat label="max HR" value={w.maxHr ?? '—'} suffix="bpm" />
      </section>

      <h2 style={sectionLabel}>heart rate</h2>
      <HrCurve
        samples={samples}
        maxHr={maxHr}
        startTime={w.startTime}
        endTime={w.endTime}
      />

      {w.zoneMinutesJsonb && (
        <>
          <h2 style={sectionLabel}>time in zone</h2>
          <div style={cardStyle}>
            <ZoneBar zones={w.zoneMinutesJsonb} height={20} />
          </div>
        </>
      )}

      {duplicates.length > 0 && (
        <>
          <h2 style={sectionLabel}>also recorded by</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {duplicates.map((d) => (
              <div key={d.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13 }}>{d.type}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {d.calories != null && (
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {fmt.format(d.calories)} kcal
                      </span>
                    )}
                    <SourceBadge source={d.source} />
                    <button
                      onClick={async () => {
                        await api.pinPrimary(d.id)
                        await load()
                      }}
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    >
                      use this
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginTop: 24,
  marginBottom: 8,
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string
  value: number | string
  suffix?: string
}) {
  return (
    <div style={cardStyle}>
      <span
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 600 }}>
        {typeof value === 'number' ? fmt.format(value) : value}{' '}
        {suffix && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{suffix}</span>}
      </span>
    </div>
  )
}

function timeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const f = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${f.format(start)} – ${f.format(end)}`
}
