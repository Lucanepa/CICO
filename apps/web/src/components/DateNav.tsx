import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { localIsoDate } from '../lib/api'

type Props = {
  date: string
  onChange: (date: string) => void
}

function shiftIsoDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function DateNav({ date, onChange }: Props) {
  const today = localIsoDate()
  const isToday = date === today
  return (
    <div className="flex items-center gap-1.5">
      <Button
        onClick={() => onChange(shiftIsoDate(date, -1))}
        variant="outline"
        size="sm"
        className="px-2"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => onChange(shiftIsoDate(date, 1))}
        variant="outline"
        size="sm"
        disabled={isToday}
        className="px-2"
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isToday && (
        <Button onClick={() => onChange(today)} variant="outline" size="sm">
          Today
        </Button>
      )}
    </div>
  )
}

export function relativeDateLabel(iso: string): string {
  const today = localIsoDate()
  if (iso === today) return 'Today'
  const a = new Date(`${iso}T00:00:00`)
  const b = new Date(`${today}T00:00:00`)
  const days = Math.round((a.getTime() - b.getTime()) / 86_400_000)
  if (days === -1) return 'Yesterday'
  if (days === 1) return 'Tomorrow'
  if (days < 0 && days >= -6) return `${-days}d ago`
  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(a)
}

export function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(d)
}
