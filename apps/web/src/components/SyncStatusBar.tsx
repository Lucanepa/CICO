import { useEffect, useState } from 'react'
import { CheckCircle2, CircleDot, Loader2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { api, type Integration } from '../lib/api'

type Props = {
  refreshTick?: number
}

export function SyncStatusBar({ refreshTick }: Props) {
  const [integrations, setIntegrations] = useState<Integration[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .integrations()
      .then((r) => {
        if (!cancelled) setIntegrations(r.integrations)
      })
      .catch(() => {
        if (!cancelled) setIntegrations([])
      })
    return () => {
      cancelled = true
    }
  }, [refreshTick])

  if (!integrations) return null
  const visible = integrations.filter((i) => i.configured)
  if (visible.length === 0) return null

  return (
    <Card className="flex items-center gap-3 overflow-x-auto p-3 text-xs">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
        Sources
      </span>
      <div className="flex items-center gap-3">
        {visible.map((i) => (
          <SourcePill key={i.source} i={i} />
        ))}
      </div>
    </Card>
  )
}

function SourcePill({ i }: { i: Integration }) {
  const { Icon, tone, hint } = pillState(i)
  return (
    <span
      title={hint}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5',
        tone === 'success' && 'bg-primary/10 text-primary',
        tone === 'pending' && 'bg-muted text-muted-foreground',
        tone === 'warn' && 'bg-warning/15 text-warning',
        tone === 'error' && 'bg-destructive/15 text-destructive',
      )}
    >
      <Icon className={cn('h-3 w-3', tone === 'pending' && 'animate-pulse')} />
      <span className="capitalize">{i.label}</span>
      <span className="text-[10px] opacity-70">{relativeAgo(i.lastSyncedAt)}</span>
    </span>
  )
}

function pillState(i: Integration) {
  if (!i.connected) return { Icon: CircleDot, tone: 'pending' as const, hint: 'Not connected' }
  if (i.lastRunStatus === 'error') {
    return { Icon: XCircle, tone: 'error' as const, hint: i.lastError ?? 'Sync error' }
  }
  if (!i.lastSyncedAt) {
    return { Icon: Loader2, tone: 'pending' as const, hint: 'Awaiting first sync' }
  }
  const age = Date.now() - new Date(i.lastSyncedAt).getTime()
  if (age > 36 * 3600_000) {
    return { Icon: XCircle, tone: 'warn' as const, hint: `Last sync ${relativeAgo(i.lastSyncedAt)}` }
  }
  return { Icon: CheckCircle2, tone: 'success' as const, hint: `Last sync ${relativeAgo(i.lastSyncedAt)}` }
}

function relativeAgo(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'now'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const days = Math.floor(hr / 24)
  return `${days}d`
}
