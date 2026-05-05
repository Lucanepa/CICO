type Props = {
  values: Array<{ x: string; y: number | null }>
  color: string
  yMin?: number
  yMax?: number
  height?: number
}

export function SparkLine({ values, color, yMin, yMax, height = 80 }: Props) {
  const present = values.filter((v): v is { x: string; y: number } => v.y != null)
  if (present.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          fontSize: 11,
        }}
      >
        no data
      </div>
    )
  }
  const W = 480
  const H = height
  const padT = 8
  const padB = 14
  const innerH = H - padT - padB

  const ys = present.map((v) => v.y)
  const lo = yMin ?? Math.min(...ys)
  const hi = yMax ?? Math.max(...ys)
  const span = Math.max(1, hi - lo)
  const xOf = (i: number) => (i / Math.max(1, values.length - 1)) * W
  const yOf = (y: number) => padT + ((hi - y) / span) * innerH

  let path = ''
  let drawing = false
  values.forEach((v, i) => {
    if (v.y == null) {
      drawing = false
      return
    }
    const cmd = drawing ? 'L' : 'M'
    drawing = true
    path += `${cmd}${xOf(i).toFixed(1)},${yOf(v.y).toFixed(1)} `
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
      <text x={4} y={H - 2} fill="var(--muted)" fontSize="9">
        {values[0]!.x.slice(5)}
      </text>
      <text x={W - 4} y={H - 2} fill="var(--muted)" fontSize="9" textAnchor="end">
        {values[values.length - 1]!.x.slice(5)}
      </text>
    </svg>
  )
}
