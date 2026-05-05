import { useEffect, useState } from 'react'

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
    <div
      style={{
        position: 'fixed',
        bottom: 70,
        left: 12,
        right: 12,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 20,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div style={{ flex: 1, fontSize: 13 }}>
        <div style={{ fontWeight: 600 }}>Install CICO</div>
        <div style={{ color: 'var(--muted)', fontSize: 11 }}>
          home-screen access, works offline
        </div>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1')
          setDismissed(true)
        }}
        style={{ padding: '4px 8px', fontSize: 12 }}
      >
        later
      </button>
      <button
        onClick={async () => {
          await event.prompt()
          await event.userChoice
          setEvent(null)
        }}
        style={{
          padding: '6px 12px',
          fontSize: 12,
          background: 'var(--accent)',
          color: '#0a0a0a',
          borderColor: 'var(--accent)',
        }}
      >
        install
      </button>
    </div>
  )
}
