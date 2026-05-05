import { useCallback, useEffect, useState } from 'react'
import { AddFoodSheet } from '../components/AddFoodSheet'
import { api, localIsoDate, type FoodLogEntry } from '../lib/api'

const fmt = new Intl.NumberFormat('en-US')

export function Food() {
  const [date] = useState(() => localIsoDate())
  const [entries, setEntries] = useState<FoodLogEntry[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.foodLog(date)
      setEntries(res.entries)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <div style={{ padding: 24, color: 'var(--danger)' }}>error: {error}</div>
  if (!entries) return <div style={{ padding: 24 }}>loading…</div>

  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      p: acc.p + (e.p ?? 0),
      c: acc.c + (e.c ?? 0),
      f: acc.f + (e.f ?? 0),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  )

  return (
    <main style={{ padding: '24px 20px 96px', maxWidth: 480, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{prettyDate(date)}</div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Food</h1>
        </div>
        <button
          onClick={() => setAdding(true)}
          style={{ background: 'var(--primary)', color: '#0a0a0a', borderColor: 'var(--primary)' }}
        >
          + add
        </button>
      </header>

      <section style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>
          today's intake
        </div>
        <div style={{ fontSize: 26, fontWeight: 700 }}>{fmt.format(totals.kcal)} kcal</div>
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          {totals.p.toFixed(0)}P · {totals.c.toFixed(0)}C · {totals.f.toFixed(0)}F
        </div>
      </section>

      {entries.length === 0 ? (
        <div style={{ marginTop: 24, color: 'var(--muted-foreground)', fontSize: 13 }}>
          nothing logged yet — tap "+ add" to start.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {entries.map((e) => (
            <Row
              key={e.id}
              entry={e}
              onDelete={async () => {
                await api.deleteFoodLog(e.id)
                await load()
              }}
            />
          ))}
        </div>
      )}

      <AddFoodSheet
        open={adding}
        onClose={() => setAdding(false)}
        date={date}
        onAdded={load}
      />
    </main>
  )
}

function Row({ entry, onDelete }: { entry: FoodLogEntry; onDelete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14 }}>{entry.sourceLabel ?? '(unknown food)'}</span>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {entry.quantityG}g
            {entry.time ? ` · ${entry.time.slice(0, 5)}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt.format(entry.kcal)}</span>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onDelete()
              } finally {
                setBusy(false)
              }
            }}
            style={{ padding: '4px 8px', fontSize: 11, color: 'var(--danger)' }}
          >
            delete
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
  gap: 6,
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'short' }).format(
    d,
  )
}
