import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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

  if (error)
    return (
      <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-4xl px-5 pt-10 text-sm text-destructive">Error: {error}</main>
    )
  if (!workouts)
    return (
      <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-4xl px-5 pt-10 text-sm text-muted-foreground">Loading…</main>
    )

  const dayZones = sumZones(workouts.filter((w) => w.isPrimary).map((w) => w.zoneMinutesJsonb))
  const primary = workouts.filter((w) => w.isPrimary)
  const duplicates = workouts.filter((w) => !w.isPrimary)

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 px-5 pb-28 pt-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
          {prettyDate(date)}
        </p>
      </header>

      <Card className="flex flex-col gap-3 p-4">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Time in zone (primary workouts)
        </span>
        {dayZones ? (
          <ZoneBar zones={dayZones} height={20} />
        ) : (
          <p className="text-sm text-muted-foreground">No HR data today.</p>
        )}
      </Card>

      <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Workouts</h2>
      {primary.length === 0 && (
        <p className="text-sm text-muted-foreground">No workouts logged today.</p>
      )}
      <div className="flex flex-col gap-2.5">
        {primary.map((w) => (
          <Card
            key={w.id}
            onClick={() => navigate(`/workout/${w.id}`)}
            className="flex cursor-pointer flex-col gap-2.5 p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-base font-semibold">{w.type}</span>
                <span className="text-xs text-muted-foreground">
                  {timeRange(w.startTime, w.endTime)} · {Math.round(w.durationMin)} min
                </span>
              </div>
              <div className="flex items-center gap-2">
                {w.calories != null && (
                  <span className="text-sm font-semibold">{fmt.format(w.calories)} kcal</span>
                )}
                <SourceBadge source={w.source} />
              </div>
            </div>
            {w.zoneMinutesJsonb && <ZoneBar zones={w.zoneMinutesJsonb} />}
          </Card>
        ))}
      </div>

      {duplicates.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            {duplicates.length} duplicate{duplicates.length === 1 ? '' : 's'}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {duplicates.map((w) => (
              <DuplicateRow
                key={w.id}
                w={w}
                onPin={async () => {
                  await api.pinPrimary(w.id)
                  const res = await api.workouts(date)
                  setWorkouts(res.workouts)
                }}
              />
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
    <Card className={cn('p-3 opacity-70 bg-secondary/40')}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">{w.type}</div>
        <div className="flex items-center gap-2">
          {w.calories != null && (
            <span className="text-xs text-muted-foreground">{fmt.format(w.calories)} kcal</span>
          )}
          <SourceBadge source={w.source} />
          <Button
            size="sm"
            variant="outline"
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
          >
            Use this
          </Button>
        </div>
      </div>
    </Card>
  )
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
  const f = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${f.format(start)} – ${f.format(end)}`
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(d)
}
