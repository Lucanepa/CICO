import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { BodyCard } from '@/components/BodyCard'
import { Donut } from '@/components/Donut'
import { EnergyBalanceChip } from '@/components/EnergyBalanceChip'
import { FitnessCard } from '@/components/FitnessCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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

  if (loading)
    return (
      <main className="mx-auto max-w-md px-5 pt-10 text-sm text-muted-foreground">
        Loading…
      </main>
    )
  if (error)
    return (
      <main className="mx-auto max-w-md px-5 pt-10 text-sm text-destructive">
        Error: {error}
      </main>
    )
  if (!breakdown) return null

  const net = breakdown.net
  const netLabel = net === 0 ? 'even' : net > 0 ? 'surplus' : 'deficit'
  const netClass =
    net === 0
      ? 'text-foreground'
      : net > 0
        ? 'text-warning'
        : 'text-primary'

  return (
    <main className="mx-auto max-w-md space-y-5 px-5 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {prettyDate(breakdown.date)}
          </p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">Today</h1>
        </div>
        <Button
          onClick={refreshNow}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          {refreshing ? 'Syncing…' : 'Sync'}
        </Button>
      </header>

      <section className="flex flex-col items-center pt-2">
        <div className="relative">
          <Donut intake={breakdown.intake} burn={breakdown.burn} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Net
            </span>
            <span className={cn('text-5xl font-bold leading-none', netClass)}>
              {Math.abs(net) > 0
                ? `${net > 0 ? '+' : '−'}${fmt.format(Math.abs(net))}`
                : '0'}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">{netLabel}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Intake" value={breakdown.intake} dotClass="bg-intake" suffix="kcal" />
        <Stat label="Burn" value={breakdown.burn} dotClass="bg-burn" suffix="kcal" />
      </section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          Burn breakdown
        </h2>
        <Card className="flex flex-col gap-2 p-4">
          <Row label={`Base — ${breakdown.baseSource}`} value={breakdown.baseTotal} />
          {breakdown.baseSourceWorkoutsSubtracted > 0 && (
            <Row
              label="− base workouts"
              value={-breakdown.baseSourceWorkoutsSubtracted}
              tone="muted"
            />
          )}
          {breakdown.primaryWorkoutsAdded > 0 && (
            <Row label="+ primary workouts" value={breakdown.primaryWorkoutsAdded} />
          )}
          {breakdown.watchOffWorkoutsAdded > 0 && (
            <Row
              label="+ watch-off (Oura)"
              value={breakdown.watchOffWorkoutsAdded}
              tone="warning"
            />
          )}
          <Row label="Total" value={breakdown.burn} bold />
        </Card>
      </section>

      <BodyCard />
      <EnergyBalanceChip date={breakdown.date} />
      <FitnessCard date={breakdown.date} />

      {breakdown.flags.length > 0 && (
        <section>
          <div className="flex flex-wrap gap-1.5">
            {breakdown.flags.map((f) => (
              <Badge key={f} variant="default">
                {f.replaceAll('_', ' ')}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

function Stat({
  label,
  value,
  dotClass,
  suffix,
}: {
  label: string
  value: number
  dotClass: string
  suffix: string
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <span className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className={cn('inline-block h-2 w-2 rounded-full', dotClass)} />
        {label}
      </span>
      <span className="text-2xl font-semibold leading-none">
        {fmt.format(value)}{' '}
        <span className="text-xs font-normal text-muted-foreground">{suffix}</span>
      </span>
    </Card>
  )
}

function Row({
  label,
  value,
  tone,
  bold = false,
}: {
  label: string
  value: number
  tone?: 'muted' | 'warning'
  bold?: boolean
}) {
  return (
    <div
      className={cn(
        'flex justify-between',
        tone === 'muted' && 'text-muted-foreground',
        tone === 'warning' && 'text-warning',
        bold && 'border-t border-border pt-2 font-semibold',
      )}
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
