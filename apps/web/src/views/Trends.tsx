import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SparkBars } from '../components/SparkBars'
import { SparkLine } from '../components/SparkLine'
import { api, type BodyMeasurement, type TrendDay } from '../lib/api'

const RANGES = [7, 30, 90] as const
const fmt = new Intl.NumberFormat('en-US')

export function Trends() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<TrendDay[] | null>(null)
  const [body, setBody] = useState<BodyMeasurement[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [trendsRes, bodyRes] = await Promise.all([api.trends(days), api.bodySeries(days)])
        if (!cancelled) {
          setData(trendsRes.days)
          setBody(bodyRes.series)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [days])

  if (error)
    return (
      <main className="mx-auto max-w-md px-5 pt-10 text-sm text-destructive">
        Error: {error}
      </main>
    )

  const totals = (data ?? []).reduce(
    (acc, d) => ({
      net: acc.net + d.net,
      z2: acc.z2 + d.z2plusMinutes,
      sleep: d.sleepScore != null ? acc.sleep + d.sleepScore : acc.sleep,
      sleepN: d.sleepScore != null ? acc.sleepN + 1 : acc.sleepN,
    }),
    { net: 0, z2: 0, sleep: 0, sleepN: 0 },
  )
  const avgSleep = totals.sleepN > 0 ? Math.round(totals.sleep / totals.sleepN) : null
  const avgNet = data ? Math.round(totals.net / data.length) : 0

  return (
    <main className="mx-auto max-w-md space-y-4 px-5 pb-28 pt-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Trends</h1>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
          Last {days} days
        </p>
      </header>

      <div className="inline-flex w-full items-center gap-1 rounded-lg bg-muted p-1 text-sm">
        {RANGES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setDays(n)}
            className={cn(
              'flex-1 rounded-md py-1.5 transition-colors',
              days === n
                ? 'bg-background text-foreground shadow'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {n}d
          </button>
        ))}
      </div>

      {loading && !data && <p className="text-sm text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <ChartCard title="Net balance" subtitle={`Avg ${signed(avgNet)} kcal/day`}>
            <SparkBars
              values={data.map((d) => ({ x: d.date, y: d.net }))}
              positiveColor="#fbbf24"
              negativeColor="#4ade80"
              height={100}
            />
            <Legend
              items={[
                { label: 'Deficit', color: '#4ade80' },
                { label: 'Surplus', color: '#fbbf24' },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="Sleep score"
            subtitle={avgSleep != null ? `Avg ${avgSleep}` : 'No data'}
          >
            <SparkLine
              values={data.map((d) => ({ x: d.date, y: d.sleepScore }))}
              color="#a5b4fc"
              yMin={0}
              yMax={100}
              height={90}
            />
          </ChartCard>

          <ChartCard title="Time in zone 2+" subtitle={`${fmt.format(totals.z2)} min total`}>
            <SparkBars
              values={data.map((d) => ({ x: d.date, y: d.z2plusMinutes }))}
              positiveColor="#34d399"
              height={90}
            />
          </ChartCard>

          {body && body.length > 0 && (
            <>
              {hasField(body, 'weightKg') && (
                <ChartCard
                  title="Weight"
                  subtitle={summarizeRange(body, 'weightKg', (n) => `${n.toFixed(1)} kg`)}
                >
                  <SparkLine
                    values={alignSeries(data, body, 'weightKg')}
                    color="#60a5fa"
                    height={90}
                  />
                </ChartCard>
              )}
              {hasField(body, 'fatPct') && (
                <ChartCard
                  title="Body fat"
                  subtitle={summarizeRange(body, 'fatPct', (n) => `${n.toFixed(1)} %`)}
                >
                  <SparkLine
                    values={alignSeries(data, body, 'fatPct')}
                    color="#f472b6"
                    height={90}
                  />
                </ChartCard>
              )}
            </>
          )}
        </>
      )}
    </main>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-baseline justify-between">
        <CardTitle>{title}</CardTitle>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="mt-1 flex gap-3">
      {items.map((it) => (
        <span
          key={it.label}
          className="flex items-center gap-1 text-[10px] text-muted-foreground"
        >
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: it.color }}
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}

function signed(n: number): string {
  if (n === 0) return '0'
  return n > 0 ? `+${fmt.format(n)}` : `−${fmt.format(Math.abs(n))}`
}

type BodyKey = 'weightKg' | 'fatPct'

function hasField(rows: BodyMeasurement[], key: BodyKey): boolean {
  return rows.some((r) => r[key] != null)
}

function summarizeRange(
  rows: BodyMeasurement[],
  key: BodyKey,
  fmtVal: (n: number) => string,
): string {
  const present = rows.filter((r): r is BodyMeasurement & Record<BodyKey, number> => r[key] != null)
  if (present.length === 0) return 'no data'
  const first = present[0]![key]
  const last = present[present.length - 1]![key]
  const delta = last - first
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : ''
  return `${fmtVal(last)} (${sign}${fmtVal(Math.abs(delta)).replace(/[a-z%\s]+$/i, '').trim()})`
}

function alignSeries(
  trend: TrendDay[],
  body: BodyMeasurement[],
  key: BodyKey,
): Array<{ x: string; y: number | null }> {
  const lastByDate = new Map<string, number>()
  for (const m of body) {
    const v = m[key]
    if (v == null) continue
    lastByDate.set(m.date, v)
  }
  return trend.map((d) => ({ x: d.date, y: lastByDate.get(d.date) ?? null }))
}
