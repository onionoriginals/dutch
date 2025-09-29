import * as React from 'react'
import { computeSchedule, type DecayType } from '@originals/dutch/browser'

export type SparklinePoint = { t: number; price: number }

export type DutchScheduleInput = {
  startPrice: number
  floorPrice: number
  durationSeconds: number
  intervalSeconds: number
  decayType: DecayType
}

export function PriceSparkline(props: {
  points?: SparklinePoint[]
  dutchInput?: DutchScheduleInput
  width?: number
  height?: number
  className?: string
  title?: string
}) {
  const { width = 320, height = 80, className, title } = props

  const computedPoints: SparklinePoint[] = React.useMemo(() => {
    if (props.points && props.points.length > 0) return props.points
    if (props.dutchInput) {
      const schedule = computeSchedule(props.dutchInput)
      return schedule.points.map((p) => ({ t: p.t, price: p.price }))
    }
    return [] as SparklinePoint[]
  }, [props.points, props.dutchInput])

  const padding = 6
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  let path = ''
  if (computedPoints.length > 0) {
    const tMax = computedPoints[computedPoints.length - 1]!.t || 1
    const pMax = Math.max(...computedPoints.map((p) => p.price))
    const pMin = Math.min(...computedPoints.map((p) => p.price))
    const priceRange = Math.max(1, pMax - pMin)
    for (let i = 0; i < computedPoints.length; i++) {
      const px = padding + (computedPoints[i]!.t / tMax) * innerW
      const py = padding + innerH - ((computedPoints[i]!.price - pMin) / priceRange) * innerH
      path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`
    }
  }

  return (
    <svg
      role="img"
      aria-label={title || 'Price schedule preview'}
      viewBox={`0 0 ${width} ${height}`}
      className={className || 'h-20 w-full max-w-sm select-none text-blue-600 dark:text-blue-400'}
    >
      <rect x={0} y={0} width={width} height={height} rx={6} className="fill-[var(--chart-bg,#ffffff)] stroke-[var(--chart-border,#e5e7eb)] dark:fill-[var(--chart-bg-dark,#0b0f17)] dark:stroke-[var(--chart-border-dark,#374151)]" />
      {path && <path d={path} className="stroke-current" fill="none" strokeWidth={2} />}
      <title>{title || 'Price schedule preview'}</title>
    </svg>
  )
}

export default PriceSparkline

