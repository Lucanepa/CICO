import { useState } from 'react'
import { Camera, Link2, Search, ScanBarcode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { api, type SearchHit } from '../lib/api'
import { Sheet } from './Sheet'

type Mode = 'search' | 'barcode' | 'photo' | 'url'

type Props = {
  open: boolean
  onClose: () => void
  date: string
  onAdded: () => void
}

const MODES: Array<{ key: Mode; label: string; icon: typeof Search }> = [
  { key: 'search', label: 'Search', icon: Search },
  { key: 'barcode', label: 'Barcode', icon: ScanBarcode },
  { key: 'photo', label: 'Photo', icon: Camera },
  { key: 'url', label: 'URL', icon: Link2 },
]

export function AddFoodSheet({ open, onClose, date, onAdded }: Props) {
  const [mode, setMode] = useState<Mode>('search')
  const [picked, setPicked] = useState<SearchHit | null>(null)

  const reset = () => {
    setPicked(null)
    setMode('search')
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Add food"
    >
      {!picked && (
        <div className="space-y-4">
          <ModeTabs mode={mode} onChange={setMode} />
          {mode === 'search' && <SearchPane onPick={setPicked} />}
          {mode === 'barcode' && <BarcodePane onPick={setPicked} />}
          {mode === 'photo' && <PhotoPane onPick={setPicked} />}
          {mode === 'url' && <UrlPane onPick={setPicked} />}
        </div>
      )}
      {picked && (
        <QuantityPane
          hit={picked}
          date={date}
          onCancel={reset}
          onSaved={() => {
            reset()
            onAdded()
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
      {MODES.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            'flex flex-col items-center justify-center gap-1 rounded-md py-2 text-[11px] transition-colors',
            mode === key
              ? 'bg-background text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}

function SearchPane({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState(false)

  const search = async (text: string) => {
    setQ(text)
    if (text.length < 2) {
      setHits([])
      return
    }
    setBusy(true)
    try {
      const res = await api.searchFoods(text)
      setHits(res.hits)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Input
        autoFocus
        value={q}
        onChange={(e) => void search(e.target.value)}
        placeholder="Search foods"
      />
      <div className="flex flex-col gap-1.5">
        {busy && <span className="text-xs text-muted-foreground">Searching…</span>}
        {hits.map((h) => (
          <HitRow key={`${h.table}:${h.id}`} hit={h} onPick={() => onPick(h)} />
        ))}
        {!busy && q.length >= 2 && hits.length === 0 && (
          <span className="text-xs text-muted-foreground">No results.</span>
        )}
      </div>
    </div>
  )
}

function BarcodePane({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const lookup = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.byBarcode(code.trim())
      if (!res.hit) {
        setError('Not found')
        return
      }
      onPick(res.hit)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Barcode (EAN/UPC)"
        inputMode="numeric"
      />
      <Button onClick={lookup} disabled={busy || code.length < 6} className="w-full">
        {busy ? 'Looking up…' : 'Lookup'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function PhotoPane({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const handleFile = async (file: File) => {
    setBusy(true)
    setError(null)
    setWarnings([])
    try {
      const base64 = await fileToBase64(file)
      const mt = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
        ? file.type
        : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      const res = await api.ocr(base64, mt, true)
      if (res.ocr.warnings?.length) setWarnings(res.ocr.warnings)
      if (!res.food) {
        setError('OCR did not return a usable food.')
        return
      }
      onPick(res.food)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Snap a nutrition label. Macros are extracted via Claude.
      </p>
      <Input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
        className="file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-foreground"
      />
      {busy && <p className="text-xs text-muted-foreground">Extracting…</p>}
      {warnings.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-warning">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function UrlPane({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importIt = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.fromUrl(url, true)
      if (!res.food) {
        setError('Recipe missing per-serving info — open it manually.')
        return
      }
      onPick(res.food)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <Input
        autoFocus
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
      />
      <Button onClick={importIt} disabled={busy || !/^https?:\/\//.test(url)} className="w-full">
        {busy ? 'Fetching…' : 'Import recipe'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function HitRow({ hit, onPick }: { hit: SearchHit; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
    >
      <div className="flex flex-col">
        <span className="text-sm">{hit.name}</span>
        <span className="text-[11px] text-muted-foreground">
          {hit.source}
          {hit.barcode ? ` · ${hit.barcode}` : ''}
        </span>
      </div>
      <span className="text-sm font-semibold">
        {Math.round(hit.kcal100g)} <span className="text-[10px] text-muted-foreground">kcal/100g</span>
      </span>
    </button>
  )
}

function QuantityPane({
  hit,
  date,
  onCancel,
  onSaved,
}: {
  hit: SearchHit
  date: string
  onCancel: () => void
  onSaved: () => void
}) {
  const [grams, setGrams] = useState<number>(hit.defaultServingG ?? 100)
  const [busy, setBusy] = useState(false)
  const factor = grams / 100
  const kcal = Math.round(hit.kcal100g * factor)

  const save = async () => {
    setBusy(true)
    try {
      await api.addFoodLog({
        date,
        foodId: hit.id,
        foodTable: hit.table,
        quantityG: grams,
      })
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-base font-semibold">{hit.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {hit.kcal100g.toFixed(0)} kcal · {hit.p100g ?? '—'}P · {hit.c100g ?? '—'}C ·{' '}
          {hit.f100g ?? '—'}F (per 100g)
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="grams">Grams</Label>
        <Input
          id="grams"
          type="number"
          min={1}
          step={1}
          value={grams}
          onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 0))}
        />
      </div>

      <div className="rounded-lg bg-muted px-4 py-3 text-center">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated</div>
        <div className="text-2xl font-bold">{kcal} kcal</div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Back
        </Button>
        <Button onClick={save} disabled={busy} className="flex-[2]">
          {busy ? 'Saving…' : 'Add to log'}
        </Button>
      </div>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const result = typeof r.result === 'string' ? r.result : ''
      const i = result.indexOf(',')
      resolve(i >= 0 ? result.slice(i + 1) : result)
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}
