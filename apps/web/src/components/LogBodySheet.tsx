import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      setError('Enter at least one value')
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
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>
                {f.label}
                {f.suffix ? ` (${f.suffix})` : ''}
              </Label>
              <Input
                id={f.key}
                type="number"
                inputMode="decimal"
                step={f.step}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note">Note (optional)</Label>
          <Input
            id="note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </Sheet>
  )
}
