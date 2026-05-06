import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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

  if (error)
    return (
      <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-4xl px-5 pt-10 text-sm text-destructive">Error: {error}</main>
    )
  if (!data)
    return (
      <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-4xl px-5 pt-10 text-sm text-muted-foreground">Loading…</main>
    )

  const { workout: w, samples, duplicates, maxHr } = data

  return (
    <main className="mx-auto max-w-md md:max-w-2xl lg:max-w-4xl space-y-4 px-5 pb-28 pt-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1 text-muted-foreground"
        onClick={() => navigate(-1)}
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Button>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{w.type}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeRange(w.startTime, w.endTime)} · {Math.round(w.durationMin)} min
          </p>
        </div>
        <SourceBadge source={w.source} />
      </header>

      <section className="grid grid-cols-3 gap-2">
        <Stat label="Kcal" value={w.calories ?? '—'} />
        <Stat label="Avg HR" value={w.avgHr ?? '—'} suffix="bpm" />
        <Stat label="Max HR" value={w.maxHr ?? '—'} suffix="bpm" />
      </section>

      <h2 className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">Heart rate</h2>
      <Card className="p-3">
        <HrCurve samples={samples} maxHr={maxHr} startTime={w.startTime} endTime={w.endTime} />
      </Card>

      {w.zoneMinutesJsonb && (
        <>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">Time in zone</h2>
          <Card className="p-4">
            <ZoneBar zones={w.zoneMinutesJsonb} height={20} />
          </Card>
        </>
      )}

      {duplicates.length > 0 && (
        <>
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
            Also recorded by
          </h2>
          <div className="flex flex-col gap-2">
            {duplicates.map((d) => (
              <Card key={d.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm">{d.type}</div>
                  <div className="flex items-center gap-2">
                    {d.calories != null && (
                      <span className="text-xs text-muted-foreground">
                        {fmt.format(d.calories)} kcal
                      </span>
                    )}
                    <SourceBadge source={d.source} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await api.pinPrimary(d.id)
                        await load()
                      }}
                    >
                      Use this
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </main>
  )
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
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold leading-none">
        {typeof value === 'number' ? fmt.format(value) : value}{' '}
        {suffix && <span className="text-[10px] font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </Card>
  )
}

function timeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const f = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${f.format(start)} – ${f.format(end)}`
}
