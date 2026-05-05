import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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

  if (error)
    return (
      <main className="mx-auto max-w-md px-5 pt-10 text-sm text-destructive">Error: {error}</main>
    )
  if (!entries)
    return (
      <main className="mx-auto max-w-md px-5 pt-10 text-sm text-muted-foreground">Loading…</main>
    )

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
    <main className="mx-auto max-w-md space-y-4 px-5 pb-28 pt-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{prettyDate(date)}</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">Food</h1>
        </div>
        <Button onClick={() => setAdding(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </header>

      <Card className="flex flex-col gap-1 p-4">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Today's intake
        </span>
        <span className="text-2xl font-bold leading-none">{fmt.format(totals.kcal)} kcal</span>
        <span className="text-xs text-muted-foreground">
          {totals.p.toFixed(0)}P · {totals.c.toFixed(0)}C · {totals.f.toFixed(0)}F
        </span>
      </Card>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing logged yet — tap “Add” to start.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
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

      <AddFoodSheet open={adding} onClose={() => setAdding(false)} date={date} onAdded={load} />
    </main>
  )
}

function Row({ entry, onDelete }: { entry: FoodLogEntry; onDelete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-sm">{entry.sourceLabel ?? '(unknown food)'}</span>
          <span className="text-[11px] text-muted-foreground">
            {entry.quantityG}g{entry.time ? ` · ${entry.time.slice(0, 5)}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{fmt.format(entry.kcal)}</span>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={async () => {
              setBusy(true)
              try {
                await onDelete()
              } finally {
                setBusy(false)
              }
            }}
            aria-label="Delete entry"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
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
