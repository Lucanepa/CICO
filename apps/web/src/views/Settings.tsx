import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Settings as SettingsIcon, Unplug } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { api, type Integration } from '../lib/api'

export function Settings() {
  const [items, setItems] = useState<Integration[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busySource, setBusySource] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.integrations()
      setItems(res.integrations)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const disconnect = async (source: string) => {
    if (!confirm(`Disconnect ${source}? Stored tokens will be removed.`)) return
    setBusySource(source)
    try {
      await api.disconnectIntegration(source)
      await load()
    } finally {
      setBusySource(null)
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-5 pb-28 pt-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Integrations</p>
        </div>
      </header>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {!items && !error && <p className="text-sm text-muted-foreground">Loading…</p>}

      {items && (
        <div className="flex flex-col gap-2.5">
          {items.map((it) => (
            <Card key={it.source} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-base font-semibold">{it.label}</span>
                  <span className="text-xs text-muted-foreground">{it.description}</span>
                </div>
                <StatusPill it={it} />
              </div>

              <div className="flex items-center gap-2">
                {!it.configured && (
                  <span className="text-xs text-muted-foreground">
                    Not configured (set the env vars on the API).
                  </span>
                )}
                {it.configured && !it.connected && (
                  <Button asChild size="sm" className="gap-1.5">
                    <a href={it.startUrl}>
                      Connect
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                {it.configured && it.connected && (
                  <>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <a href={it.startUrl}>
                        Reconnect
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground hover:text-destructive"
                      disabled={busySource === it.source}
                      onClick={() => void disconnect(it.source)}
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      {busySource === it.source ? 'Disconnecting…' : 'Disconnect'}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}

function StatusPill({ it }: { it: Integration }) {
  if (!it.configured) return <Badge variant="default">Not configured</Badge>
  if (!it.connected) return <Badge variant="warning">Disconnected</Badge>

  const expired = it.expiresAt ? new Date(it.expiresAt).getTime() < Date.now() : false
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        expired ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary',
      )}
    >
      <CheckCircle2 className="h-3 w-3" />
      {expired ? 'Token expired' : 'Connected'}
    </span>
  )
}
