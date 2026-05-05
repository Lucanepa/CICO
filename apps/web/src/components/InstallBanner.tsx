import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'cico_install_dismissed'

export function InstallBanner() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!event || dismissed) return null
  if (window.matchMedia('(display-mode: standalone)').matches) return null

  return (
    <div className="fixed inset-x-3 bottom-[70px] z-20 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-card/95 p-3 backdrop-blur shadow-lg">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Download className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold">Install CICO</div>
        <div className="text-[11px] text-muted-foreground">
          Home-screen access, works offline.
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1')
          setDismissed(true)
        }}
      >
        Later
      </Button>
      <Button
        size="sm"
        onClick={async () => {
          await event.prompt()
          await event.userChoice
          setEvent(null)
        }}
      >
        Install
      </Button>
    </div>
  )
}
