type Props = {
  values: Array<{ x: string; y: number }>
  positiveColor: string
  negativeColor?: string
  height?: number
}

export function SparkBars({ values, positiveColor, negativeColor, height = 80 }: Props) {
  if (values.length === 0) return null
  const W = 480
  const H = height
  const padT = 4
  const padB = 14
  const innerH = H - padT - padB

  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v.y)))
  const colW = (W - 2) / values.length
  const barW = Math.max(1, colW - 2)
  const zeroY = padT + innerH / 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="var(--border)" strokeDasharray="2 4" />
      {values.map((v, i) => {
        const h = (Math.abs(v.y) / maxAbs) * (innerH / 2)
        const y = v.y >= 0 ? zeroY - h : zeroY
        const fill = v.y >= 0 ? positiveColor : (negativeColor ?? positiveColor)
        return <rect key={v.x} x={i * colW + 1} y={y} width={barW} height={h} fill={fill} rx={1} />
      })}
      <text x={4} y={H - 2} fill="var(--muted)" fontSize="9">
        {values[0]!.x.slice(5)}
      </text>
      <text x={W - 4} y={H - 2} fill="var(--muted)" fontSize="9" textAnchor="end">
        {values[values.length - 1]!.x.slice(5)}
      </text>
    </svg>
  )
}
