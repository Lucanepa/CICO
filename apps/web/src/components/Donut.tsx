type Props = {
  intake: number
  burn: number
  size?: number
}

export function Donut({ intake, burn, size = 240 }: Props) {
  const total = intake + burn || 1
  const intakeFrac = intake / total
  const burnFrac = burn / total
  const r = size / 2 - 16
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="intake vs burn">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={20}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--intake)"
        strokeWidth={20}
        strokeDasharray={`${circumference * intakeFrac} ${circumference}`}
        transform={`rotate(-90 ${cx} ${cy})`}
        strokeLinecap="round"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--burn)"
        strokeWidth={20}
        strokeDasharray={`${circumference * burnFrac} ${circumference}`}
        strokeDashoffset={-circumference * intakeFrac}
        transform={`rotate(-90 ${cx} ${cy})`}
        strokeLinecap="round"
      />
    </svg>
  )
}
