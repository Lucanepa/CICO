import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SourceBadge } from '../components/SourceBadge'
import { ZoneBar } from '../components/ZoneBar'
import { api, localIsoDate, type Workout, type ZoneMinutes } from '../lib/api'

const fmt = new Intl.NumberFormat('en-US')

export function Activity() {
  const [date] = useState(() => localIsoDate())
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.workouts(date)
        setWorkouts(res.workouts)
      } catch (err) {
        setError((err as Error).message)
      }
    })()
  }, [date])

  if (error) return <div style={{ padding: 24, color: 'var(--danger)' }}>error: {error}</div>
  if (!workouts) return <div style={{ padding: 24 }}>loading…</div>

  const dayZones = sumZones(workouts.filter((w) => w.isPrimary).map((w) => w.zoneMinutesJsonb))

  const primary = workouts.filter((w) => w.isPrimary)
  const duplicates = workouts.filter((w) => !w.isPrimary)

  return (
    <main style={{ padding: '24px 20px 96px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Activity</h1>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 24 }}>
        {prettyDate(date)}
      </div>

      <section style={cardStyle}>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
          time in zone (primary workouts)
        </div>
        {dayZones ? (
          <ZoneBar zones={dayZones} height={20} />
        ) : (
          <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>no HR data today</div>
        )}
      </section>

      <h2 style={{ fontSize: 14, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24 }}>
        workouts
      </h2>
      {primary.length === 0 && (
        <div style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>no workouts logged today</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {primary.map((w) => (
          <div
            key={w.id}
            onClick={() => navigate(`/workout/${w.id}`)}
            style={{ ...cardStyle, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{w.type}</span>
                <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {timeRange(w.startTime, w.endTime)} · {Math.round(w.durationMin)} min
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {w.calories != null && (
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt.format(w.calories)} kcal</span>
                )}
                <SourceBadge source={w.source} />
              </div>
            </div>
            {w.zoneMinutesJsonb && <ZoneBar zones={w.zoneMinutesJsonb} />}
          </div>
        ))}
      </div>

      {duplicates.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ color: 'var(--muted-foreground)', fontSize: 13, cursor: 'pointer' }}>
            {duplicates.length} duplicate{duplicates.length === 1 ? '' : 's'}
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {duplicates.map((w) => (
              <DuplicateRow key={w.id} w={w} onPin={async () => {
                await api.pinPrimary(w.id)
                const res = await api.workouts(date)
                setWorkouts(res.workouts)
              }} />
            ))}
          </div>
        </details>
      )}
    </main>
  )
}

function DuplicateRow({ w, onPin }: { w: Workout; onPin: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <div
      style={{
        ...cardStyle,
        background: 'var(--surface-2)',
        opacity: 0.7,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 13 }}>{w.type}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {w.calories != null && (
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{fmt.format(w.calories)} kcal</span>
          )}
          <SourceBadge source={w.source} />
          <button
            disabled={busy}
            onClick={async (e) => {
              e.stopPropagation()
              setBusy(true)
              try {
                await onPin()
              } finally {
                setBusy(false)
              }
            }}
            style={{ padding: '4px 8px', fontSize: 11 }}
          >
            use this
          </button>
        </div>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

function sumZones(arr: Array<ZoneMinutes | null>): ZoneMinutes | null {
  let any = false
  const out: ZoneMinutes = { z0: 0, z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 }
  for (const z of arr) {
    if (!z) continue
    any = true
    out.z0 += z.z0
    out.z1 += z.z1
    out.z2 += z.z2
    out.z3 += z.z3
    out.z4 += z.z4
    out.z5 += z.z5
  }
  return any ? out : null
}

function timeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${fmt.format(start)} – ${fmt.format(end)}`
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'short' }).format(d)
}
