const COLORS: Record<string, { bg: string; fg: string }> = {
  oura: { bg: '#1e293b', fg: '#a5b4fc' },
  strava: { bg: '#3b1d12', fg: '#fb923c' },
  huawei: { bg: '#1f1414', fg: '#f87171' },
  frontier_x: { bg: '#0f1f1c', fg: '#34d399' },
  manual: { bg: '#1c1c1c', fg: '#a3a3a3' },
}

export function SourceBadge({ source }: { source: string }) {
  const c = COLORS[source] ?? { bg: 'var(--surface-2)', fg: 'var(--muted)' }
  return (
    <span
      style={{
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 4,
        background: c.bg,
        color: c.fg,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {source.replace('_', ' ')}
    </span>
  )
}
