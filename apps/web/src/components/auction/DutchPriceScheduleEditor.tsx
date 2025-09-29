import * as React from 'react'
import { computeSchedule, type DecayType } from '@originals/dutch/browser'

export interface DutchPriceScheduleEditorProps {
  startPrice: number
  floorPrice: number
  durationSeconds: number
  intervalSeconds: number
  decayType: DecayType
  onChange: (normalized: ReturnType<typeof computeSchedule>) => void
  className?: string
}

export function DutchPriceScheduleEditor(props: DutchPriceScheduleEditorProps) {
  const [startPrice, setStartPrice] = React.useState(props.startPrice)
  const [floorPrice, setFloorPrice] = React.useState(props.floorPrice)
  const [durationSeconds, setDurationSeconds] = React.useState(props.durationSeconds)
  const [intervalSeconds, setIntervalSeconds] = React.useState(props.intervalSeconds)
  const [decayType, setDecayType] = React.useState<DecayType>(props.decayType)

  const schedule = React.useMemo(() =>
    computeSchedule({ startPrice, floorPrice, durationSeconds, intervalSeconds, decayType }),
    [startPrice, floorPrice, durationSeconds, intervalSeconds, decayType]
  )

  React.useEffect(() => {
    props.onChange(schedule)
  }, [schedule])

  const hasErrors = schedule.errors.length > 0

  return (
    <div className={props.className}>
      <form className="grid grid-cols-2 gap-3" onSubmit={(e) => e.preventDefault()} aria-describedby="schedule-errors">
        <NumberField label="Start price" value={startPrice} onChange={setStartPrice} min={0} step={1} />
        <NumberField label="Floor price" value={floorPrice} onChange={setFloorPrice} min={0} step={1} />
        <NumberField label="Duration (sec)" value={durationSeconds} onChange={setDurationSeconds} min={1} step={1} />
        <NumberField label="Interval (sec)" value={intervalSeconds} onChange={setIntervalSeconds} min={1} step={1} />

        <div className="col-span-2">
          <label className="block text-sm font-medium">Decay type</label>
          <div className="mt-1 inline-flex overflow-hidden rounded-md border border-[var(--seg-border,#e5e7eb)] dark:border-[var(--seg-border-dark,#374151)]">
            <button type="button" onClick={() => setDecayType('linear')} aria-pressed={decayType === 'linear'} className={segmentBtn(decayType === 'linear')}>Linear</button>
            <button type="button" onClick={() => setDecayType('exponential')} aria-pressed={decayType === 'exponential'} className={segmentBtn(decayType === 'exponential')}>Exponential</button>
          </div>
        </div>
      </form>

      <div className="mt-3">
        <SchedulePreview schedule={schedule} height={80} />
      </div>

      {hasErrors && (
        <ul id="schedule-errors" className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-600 dark:text-red-400">
          {schedule.errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function segmentBtn(active: boolean) {
  return (
    'px-3 py-1 text-sm transition-colors ' +
    (active ? 'bg-[var(--seg-active-bg,#f3f4f6)] dark:bg-[var(--seg-active-bg-dark,#1f2937)]' : 'bg-transparent hover:bg-[var(--seg-hover-bg,#f9fafb)] dark:hover:bg-[var(--seg-hover-bg-dark,#111827)]')
  )
}

function NumberField(props: { label: string; value: number; onChange: (n: number) => void; min?: number; step?: number }) {
  const id = React.useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{props.label}</label>
      <input
        id={id}
        type="number"
        className="mt-1 w-full rounded-md border border-[var(--input-border,#d1d5db)] bg-[var(--input-bg,#fff)] px-2 py-1 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-[var(--input-border-dark,#4b5563)] dark:bg-[var(--input-bg-dark,#0b0f17)]"
        value={Number.isFinite(props.value) ? props.value : ''}
        min={props.min}
        step={props.step}
        onChange={(e) => props.onChange(Number(e.target.value))}
        inputMode="decimal"
      />
    </div>
  )
}

function SchedulePreview(props: { schedule: ReturnType<typeof computeSchedule>; height?: number }) {
  const { schedule, height = 80 } = props
  const width = 300
  const points = schedule.points
  const padding = 6
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  let path = ''
  if (points.length > 0) {
    const tMax = points[points.length - 1]!.t || 1
    const pMax = Math.max(...points.map((p) => p.price))
    const pMin = Math.min(...points.map((p) => p.price))
    const priceRange = Math.max(1, pMax - pMin)
    for (let i = 0; i < points.length; i++) {
      const px = padding + (points[i]!.t / tMax) * innerW
      const py = padding + innerH - ((points[i]!.price - pMin) / priceRange) * innerH
      path += i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`
    }
  }

  // simple hover preview using title attribute showing price at approximate time
  return (
    <svg
      role="img"
      aria-label="Price schedule preview"
      viewBox={`0 0 ${width} ${height}`}
      className="h-20 w-full max-w-sm select-none text-blue-600 dark:text-blue-400"
    >
      <rect x={0} y={0} width={width} height={height} rx={6} className="fill-[var(--chart-bg,#ffffff)] stroke-[var(--chart-border,#e5e7eb)] dark:fill-[var(--chart-bg-dark,#0b0f17)] dark:stroke-[var(--chart-border-dark,#374151)]" />
      {path && <path d={path} className="stroke-current" fill="none" strokeWidth={2} />}
      {/* floor line */}
      {points.length > 0 && (
        <line
          x1={padding}
          x2={width - padding}
          y1={padding + (height - padding * 2) - ((schedule.input.floorPrice - Math.min(...points.map(p=>p.price))) / Math.max(1, Math.max(...points.map(p=>p.price)) - Math.min(...points.map(p=>p.price)))) * (height - padding * 2)}
          y2={padding + (height - padding * 2) - ((schedule.input.floorPrice - Math.min(...points.map(p=>p.price))) / Math.max(1, Math.max(...points.map(p=>p.price)) - Math.min(...points.map(p=>p.price)))) * (height - padding * 2)}
          className="stroke-[var(--chart-floor,#9ca3af)]"
          strokeDasharray="4 2"
          strokeWidth={1}
        />
      )}
      <title>
        {points.length > 0 ? `Start ${schedule.input.startPrice} → Floor ${schedule.input.floorPrice}` : 'Invalid schedule'}
      </title>
    </svg>
  )
}

export default DutchPriceScheduleEditor

