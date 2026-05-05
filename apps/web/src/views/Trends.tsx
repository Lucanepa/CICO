import { useEffect, useState } from 'react'
import { SparkBars } from '../components/SparkBars'
import { SparkLine } from '../components/SparkLine'
import { api, type TrendDay } from '../lib/api'

const RANGES = [7, 30, 90] as const

const fmt = new Intl.NumberFormat('en-US')

export function Trends() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<TrendDay[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await api.trends(days)
        if (!cancelled) setData(res.days)
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

  if (error) return <div style={{ padding: 24, color: 'var(--danger)' }}>error: {error}</div>

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
    <main style={{ padding: '24px 20px 96px', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Trends</h1>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
        last {days} days
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          marginBottom: 20,
        }}
      >
        {RANGES.map((n) => (
          <button
            key={n}
            onClick={() => setDays(n)}
            style={{
              padding: '8px 0',
              background: days === n ? 'var(--accent)' : 'var(--surface-2)',
              color: days === n ? '#0a0a0a' : 'var(--text)',
              borderColor: days === n ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {n}d
          </button>
        ))}
      </div>

      {loading && !data && <div style={{ color: 'var(--muted)' }}>loading…</div>}

      {data && (
        <>
          <Card title="net balance" subtitle={`avg ${signed(avgNet)} kcal/day`}>
            <SparkBars
              values={data.map((d) => ({ x: d.date, y: d.net }))}
              positiveColor="#fbbf24"
              negativeColor="#4ade80"
              height={100}
            />
            <Legend
              items={[
                { label: 'deficit', color: '#4ade80' },
                { label: 'surplus', color: '#fbbf24' },
              ]}
            />
          </Card>

          <Card title="sleep score" subtitle={avgSleep != null ? `avg ${avgSleep}` : 'no data'}>
            <SparkLine
              values={data.map((d) => ({ x: d.date, y: d.sleepScore }))}
              color="#a5b4fc"
              yMin={0}
              yMax={100}
              height={90}
            />
          </Card>

          <Card title="time in zone 2+" subtitle={`${fmt.format(totals.z2)} min total`}>
            <SparkBars
              values={data.map((d) => ({ x: d.date, y: d.z2plusMinutes }))}
              positiveColor="#34d399"
              height={90}
            />
          </Card>
        </>
      )}
    </main>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {title}
        </span>
        {subtitle && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{subtitle}</span>}
      </div>
      {children}
    </section>
  )
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
      {items.map((it) => (
        <span
          key={it.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: 'var(--muted)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: it.color,
              display: 'inline-block',
            }}
          />
          {it.label}
        </span>
      ))}
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
  gap: 8,
  marginBottom: 12,
}

function signed(n: number): string {
  if (n === 0) return '0'
  return n > 0 ? `+${fmt.format(n)}` : `−${fmt.format(Math.abs(n))}`
}
