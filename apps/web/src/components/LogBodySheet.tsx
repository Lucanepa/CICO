import { useEffect, useState, type FormEvent } from 'react'
import { api, type BodyMeasurement } from '../lib/api'
import { Sheet } from './Sheet'

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  prefill?: BodyMeasurement | null
}

type FieldKey =
  | 'weightKg'
  | 'fatPct'
  | 'muscleMassKg'
  | 'skeletalMusclePct'
  | 'boneMassKg'
  | 'waterPct'
  | 'visceralFat'
  | 'bmrKcal'
  | 'bodyAge'
  | 'bmi'

const FIELDS: Array<{ key: FieldKey; label: string; suffix: string; step: string }> = [
  { key: 'weightKg', label: 'Weight', suffix: 'kg', step: '0.1' },
  { key: 'fatPct', label: 'Body fat', suffix: '%', step: '0.1' },
  { key: 'muscleMassKg', label: 'Muscle mass', suffix: 'kg', step: '0.1' },
  { key: 'skeletalMusclePct', label: 'Skeletal muscle', suffix: '%', step: '0.1' },
  { key: 'boneMassKg', label: 'Bone mass', suffix: 'kg', step: '0.1' },
  { key: 'waterPct', label: 'Water', suffix: '%', step: '0.1' },
  { key: 'visceralFat', label: 'Visceral', suffix: '', step: '0.5' },
  { key: 'bmrKcal', label: 'BMR', suffix: 'kcal', step: '1' },
  { key: 'bodyAge', label: 'Body age', suffix: 'yr', step: '1' },
  { key: 'bmi', label: 'BMI', suffix: '', step: '0.1' },
]

export function LogBodySheet({ open, onClose, onSaved, prefill }: Props) {
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({})
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const next: Partial<Record<FieldKey, string>> = {}
    if (prefill) {
      for (const { key } of FIELDS) {
        const v = (prefill as unknown as Record<FieldKey, number | null | undefined>)[key]
        if (v != null) next[key] = String(v)
      }
    }
    setValues(next)
    setNote('')
    setError(null)
  }, [open, prefill])

  const reset = () => {
    setValues({})
    setNote('')
    setError(null)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const body: Record<string, number | string> = {}
    for (const { key } of FIELDS) {
      const raw = values[key]?.trim()
      if (!raw) continue
      const n = Number(raw)
      if (!Number.isFinite(n)) {
        setError(`${key}: not a number`)
        return
      }
      body[key] = n
    }
    if (Object.keys(body).length === 0) {
      setError('enter at least one value')
      return
    }
    if (note.trim()) body.note = note.trim()

    setSubmitting(true)
    try {
      await api.bodyLog(body as Parameters<typeof api.bodyLog>[0])
      reset()
      onSaved()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Log body"
    >
      <form onSubmit={onSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {FIELDS.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              suffix={f.suffix}
              step={f.step}
              value={values[f.key] ?? ''}
              onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
            />
          ))}
        </div>

        <label style={{ display: 'block', marginTop: 14 }}>
          <span style={labelStyle}>Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            style={inputStyle}
          />
        </label>

        {error && (
          <p style={{ marginTop: 12, color: 'var(--danger)', fontSize: 12 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '12px 0',
            background: 'var(--accent)',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Sheet>
  )
}

function Field({
  label,
  suffix,
  step,
  value,
  onChange,
}: {
  label: string
  suffix: string
  step: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 16,
}
