type Sample = { timestamp: string; bpm: number }

const ZONE_BANDS = [
  { label: 'Z0', upper: 0.49, color: 'rgba(99,99,99,0.18)' },
  { label: 'Z1', upper: 0.59, color: 'rgba(96,165,250,0.15)' },
  { label: 'Z2', upper: 0.69, color: 'rgba(52,211,153,0.18)' },
  { label: 'Z3', upper: 0.79, color: 'rgba(251,191,36,0.18)' },
  { label: 'Z4', upper: 0.89, color: 'rgba(251,146,60,0.20)' },
  { label: 'Z5', upper: 1.0, color: 'rgba(248,113,113,0.22)' },
]

type Props = {
  samples: Sample[]
  maxHr: number
  startTime: string
  endTime: string
  height?: number
}

export function HrCurve({ samples, maxHr, startTime, endTime, height = 220 }: Props) {
  if (samples.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted-foreground)',
          fontSize: 13,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
        }}
      >
        no HR samples for this workout
      </div>
    )
  }

  const W = 480
  const H = height
  const padL = 32
  const padR = 8
  const padT = 8
  const padB = 22

  const t0 = new Date(startTime).getTime()
  const t1 = new Date(endTime).getTime()
  const span = Math.max(1, t1 - t0)

  const bpmValues = samples.map((s) => s.bpm)
  const yMax = Math.max(maxHr, ...bpmValues) + 5
  const yMin = Math.max(0, Math.min(...bpmValues) - 5)

  const xOf = (ts: number) => padL + ((ts - t0) / span) * (W - padL - padR)
  const yOf = (bpm: number) => padT + ((yMax - bpm) / (yMax - yMin)) * (H - padT - padB)

  const path = samples
    .map((s, i) => {
      const x = xOf(new Date(s.timestamp).getTime())
      const y = yOf(s.bpm)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const bandRects = ZONE_BANDS.map((band, i) => {
    const lower = i === 0 ? 0 : ZONE_BANDS[i - 1]!.upper
    const yTop = yOf(band.upper * maxHr)
    const yBot = yOf(lower * maxHr)
    if (yBot <= yTop) return null
    return (
      <rect
        key={band.label}
        x={padL}
        y={yTop}
        width={W - padL - padR}
        height={yBot - yTop}
        fill={band.color}
      />
    )
  })

  const yTicks = [yMin, Math.round((yMin + yMax) / 2), Math.round(yMax)]
  const xTicks = [t0, t0 + span / 2, t1]
  const fmtT = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}
    >
      {bandRects}
      <path d={path} stroke="var(--text)" strokeWidth={1.5} fill="none" />
      {yTicks.map((bpm) => (
        <g key={bpm}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yOf(bpm)}
            y2={yOf(bpm)}
            stroke="var(--border)"
            strokeDasharray="2 4"
            strokeWidth={0.5}
          />
          <text x={4} y={yOf(bpm) + 3} fill="var(--muted-foreground)" fontSize="9">
            {bpm}
          </text>
        </g>
      ))}
      {xTicks.map((ts) => (
        <text
          key={ts}
          x={xOf(ts)}
          y={H - 6}
          fill="var(--muted-foreground)"
          fontSize="9"
          textAnchor="middle"
        >
          {fmtT.format(new Date(ts))}
        </text>
      ))}
    </svg>
  )
}
