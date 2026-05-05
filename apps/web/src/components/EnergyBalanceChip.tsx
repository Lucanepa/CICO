import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
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
  const tone = isEven ? 'muted' : isDeficit ? 'good' : 'warn'
  const Icon = isEven ? Minus : isDeficit ? TrendingDown : TrendingUp
  const label = isEven
    ? 'Flat'
    : isDeficit
      ? `${fmt.format(eb.kcalPerDay)} kcal/day deficit`
      : `${fmt.format(Math.abs(eb.kcalPerDay))} kcal/day surplus`
  const detail = `${eb.slopeKgPerWeek >= 0 ? '+' : '−'}${Math.abs(eb.slopeKgPerWeek).toFixed(2)} kg/wk · ${eb.samples} weigh-ins`

  return (
    <Card
      className={cn(
        'flex items-center gap-3 p-4',
        tone === 'good' && 'border-primary/30 bg-primary/5',
        tone === 'warn' && 'border-warning/30 bg-warning/5',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          tone === 'good' && 'bg-primary/15 text-primary',
          tone === 'warn' && 'bg-warning/15 text-warning',
          tone === 'muted' && 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Measured ({eb.windowDays}d)
        </span>
        <span
          className={cn(
            'text-sm font-semibold',
            tone === 'good' && 'text-primary',
            tone === 'warn' && 'text-warning',
          )}
        >
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground">{detail}</span>
      </div>
    </Card>
  )
}
