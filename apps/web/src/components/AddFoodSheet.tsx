import { useState } from 'react'
import { api, type SearchHit } from '../lib/api'
import { Sheet } from './Sheet'

type Mode = 'search' | 'barcode' | 'photo' | 'url'

type Props = {
  open: boolean
  onClose: () => void
  date: string
  onAdded: () => void
}

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
      title="add food"
    >
      {!picked && (
        <>
          <ModeTabs mode={mode} onChange={setMode} />
          <div style={{ marginTop: 16 }}>
            {mode === 'search' && <SearchPane onPick={setPicked} />}
            {mode === 'barcode' && <BarcodePane onPick={setPicked} />}
            {mode === 'photo' && <PhotoPane onPick={setPicked} />}
            {mode === 'url' && <UrlPane onPick={setPicked} />}
          </div>
        </>
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

const TAB_LABELS: Record<Mode, string> = {
  search: 'search',
  barcode: 'barcode',
  photo: 'photo',
  url: 'url',
}

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
      }}
    >
      {(Object.keys(TAB_LABELS) as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: '8px 0',
            fontSize: 12,
            background: mode === m ? 'var(--primary)' : 'var(--surface-2)',
            color: mode === m ? '#0a0a0a' : 'var(--text)',
            borderColor: mode === m ? 'var(--primary)' : 'var(--border)',
          }}
        >
          {TAB_LABELS[m]}
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
    <div>
      <input
        autoFocus
        value={q}
        onChange={(e) => void search(e.target.value)}
        placeholder="search foods"
        style={inputStyle}
      />
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {busy && <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>searching…</span>}
        {hits.map((h) => (
          <HitRow key={`${h.table}:${h.id}`} hit={h} onPick={() => onPick(h)} />
        ))}
        {!busy && q.length >= 2 && hits.length === 0 && (
          <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>no results</span>
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
        setError('not found')
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="barcode (EAN/UPC)"
        inputMode="numeric"
        style={inputStyle}
      />
      <button onClick={lookup} disabled={busy || code.length < 6}>
        {busy ? 'looking up…' : 'lookup'}
      </button>
      {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
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
        setError('OCR did not return a usable food')
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
        snap a nutrition label. macros are extracted via Claude.
      </p>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      {busy && <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>extracting…</span>}
      {warnings.length > 0 && (
        <ul style={{ color: 'var(--warn)', fontSize: 12, marginTop: 0 }}>
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
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
        setError('recipe missing per-serving info — open it manually')
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        autoFocus
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        style={inputStyle}
      />
      <button onClick={importIt} disabled={busy || !/^https?:\/\//.test(url)}>
        {busy ? 'fetching…' : 'import recipe'}
      </button>
      {error && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</span>}
    </div>
  )
}

function HitRow({ hit, onPick }: { hit: SearchHit; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        textAlign: 'left',
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 14 }}>{hit.name}</span>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          {hit.source}
          {hit.barcode ? ` · ${hit.barcode}` : ''}
        </span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{Math.round(hit.kcal100g)} kcal/100g</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{hit.name}</div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
        {hit.kcal100g.toFixed(0)} kcal · {hit.p100g ?? '—'} P · {hit.c100g ?? '—'} C ·{' '}
        {hit.f100g ?? '—'} F (per 100g)
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>grams</span>
        <input
          type="number"
          min={1}
          step={1}
          value={grams}
          onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 0))}
          style={inputStyle}
        />
      </label>
      <div style={{ fontSize: 22, fontWeight: 600 }}>≈ {kcal} kcal</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1 }}>
          back
        </button>
        <button
          onClick={save}
          disabled={busy}
          style={{ flex: 2, background: 'var(--primary)', color: '#0a0a0a', borderColor: 'var(--primary)' }}
        >
          {busy ? 'saving…' : 'add to log'}
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 14,
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
