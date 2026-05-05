import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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
    <Card className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Body</span>
        <div className="flex items-center gap-2">
          {m && (
            <Badge variant="default">
              {m.source}
              {ago ? ` · ${ago}` : ''}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Log
          </Button>
        </div>
      </header>

      {!m && (
        <p className="text-sm text-muted-foreground">
          No measurements yet — tap “Log” to add one.
        </p>
      )}

      {m && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
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
              label="Skel. muscle"
              value={`${fmt1.format(m.skeletalMusclePct)} %`}
              delta={diff(m.skeletalMusclePct, prior?.skeletalMusclePct)}
              suffix="%"
              betterDirection="up"
            />
          )}
          {m.waterPct != null && (
            <Stat label="Water" value={`${fmt1.format(m.waterPct)} %`} />
          )}
          {m.visceralFat != null && (
            <Stat
              label="Visceral"
              value={fmt1.format(m.visceralFat)}
              delta={diff(m.visceralFat, prior?.visceralFat)}
              betterDirection="down"
            />
          )}
          {m.bmrKcal != null && (
            <Stat label="BMR" value={`${fmt0.format(m.bmrKcal)} kcal`} />
          )}
        </div>
      )}

      {m?.source === 'manual' && m.id && (
        <Button
          variant="ghost"
          size="sm"
          className="self-end text-muted-foreground"
          onClick={async () => {
            if (!confirm('Delete this manual entry?')) return
            await api.deleteBodyLog(m.id!)
            void load()
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete entry
        </Button>
      )}

      <LogBodySheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        prefill={m ?? undefined}
        onSaved={() => {
          void load()
        }}
      />
    </Card>
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
  label,
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
  const deltaClass =
    isImprovement === true
      ? 'text-primary'
      : isImprovement === false
        ? 'text-warning'
        : 'text-muted-foreground'

  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
      {delta != null && (
        <div className={cn('mt-0.5 text-[11px]', deltaClass)}>
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
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
