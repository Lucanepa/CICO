import type { ZoneMinutes } from '../lib/api'

const COLORS: Record<keyof ZoneMinutes, string> = {
  z0: '#3a3a3a',
  z1: '#60a5fa',
  z2: '#34d399',
  z3: '#fbbf24',
  z4: '#fb923c',
  z5: '#f87171',
}

const ORDER: Array<keyof ZoneMinutes> = ['z0', 'z1', 'z2', 'z3', 'z4', 'z5']

export function ZoneBar({ zones, height = 16 }: { zones: ZoneMinutes; height?: number }) {
  const total = ORDER.reduce((sum, k) => sum + (zones[k] ?? 0), 0)
  if (total === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          height,
          borderRadius: 999,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        {ORDER.map((k) => {
          const v = zones[k]
          if (!v) return null
          return (
            <div
              key={k}
              title={`${k.toUpperCase()} — ${Math.round(v)} min`}
              style={{
                width: `${(v / total) * 100}%`,
                background: COLORS[k],
              }}
            />
          )
        })}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--muted-foreground)',
        }}
      >
        {ORDER.map((k) => (
          <span key={k}>
            {k.toUpperCase()} {Math.round(zones[k] ?? 0)}
          </span>
        ))}
      </div>
    </div>
  )
}
