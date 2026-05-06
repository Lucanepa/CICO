import { cn } from '@/lib/utils'

const PALETTE: Record<string, string> = {
  oura: 'bg-indigo-950/60 text-indigo-300',
  strava: 'bg-orange-950/60 text-orange-400',
  huawei: 'bg-red-950/60 text-red-400',
  frontier_x: 'bg-emerald-950/60 text-emerald-400',
  withings: 'bg-blue-950/60 text-blue-300',
  omron: 'bg-cyan-950/60 text-cyan-300',
  manual: 'bg-muted text-muted-foreground',
}

function label(source: string): string {
  const cleaned = source.replace('_', ' ')
  return cleaned.length > 0 ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide',
        PALETTE[source] ?? 'bg-secondary text-muted-foreground',
      )}
    >
      {label(source)}
    </span>
  )
}
