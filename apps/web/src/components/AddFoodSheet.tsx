import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Link2, Search, ScanBarcode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { api, type SearchHit } from '../lib/api'
import { foodIcon } from '@/lib/foodIcon'
import { Sheet } from './Sheet'

declare class BarcodeDetectorCtor {
  constructor(options?: { formats?: string[] })
  detect(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<
    Array<{ rawValue: string; format: string }>
  >
}

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
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stopScanRef = useRef<(() => void) | null>(null)

  const lookup = async (raw: string) => {
    const c = raw.trim()
    if (c.length < 6) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.byBarcode(c)
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

  const stopScan = useCallback(() => {
    stopScanRef.current?.()
    stopScanRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  useEffect(() => () => stopScan(), [stopScan])

  const startScan = async () => {
    setError(null)
    const Detector = (window as unknown as { BarcodeDetector?: typeof BarcodeDetectorCtor }).BarcodeDetector
    if (!Detector) {
      setError('Barcode scanner not available on this device — type the code manually below.')
      return
    }
    try {
      const detector = new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
      })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setScanning(true)
      // Wait for video element after re-render
      await new Promise((r) => requestAnimationFrame(r))
      const video = videoRef.current
      if (!video) {
        stopScan()
        return
      }
      video.srcObject = stream
      await video.play()

      let stopped = false
      stopScanRef.current = () => {
        stopped = true
      }
      const tick = async () => {
        if (stopped) return
        try {
          const codes = await detector.detect(video)
          const first = codes[0]?.rawValue
          if (first) {
            stopScan()
            setCode(first)
            await lookup(first)
            return
          }
        } catch {
          // ignore individual frame errors
        }
        if (!stopped) requestAnimationFrame(() => void tick())
      }
      void tick()
    } catch (err) {
      stopScan()
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      {!scanning && (
        <Button onClick={startScan} className="w-full gap-1.5">
          <Camera className="h-4 w-4" />
          Scan with camera
        </Button>
      )}

      {scanning && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-border bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-square w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-primary/80 shadow-[0_0_12px_var(--primary)]" />
          </div>
          <Button variant="outline" onClick={stopScan} className="w-full">
            Stop scanning
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Or enter manually
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Barcode (EAN/UPC)"
        inputMode="numeric"
      />
      <Button
        onClick={() => void lookup(code)}
        disabled={busy || code.length < 6}
        variant="outline"
        className="w-full"
      >
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
  const Icon = foodIcon(hit.name)
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{hit.name}</span>
          <span className="text-[11px] text-muted-foreground">
            {hit.source}
            {hit.barcode ? ` · ${hit.barcode}` : ''}
          </span>
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold">
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
