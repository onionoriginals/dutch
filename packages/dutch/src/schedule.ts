export type DecayType = 'linear' | 'exponential'

export interface ScheduleInput {
  startPrice: number
  floorPrice: number
  durationSeconds: number
  intervalSeconds: number
  decayType: DecayType
}

export interface SchedulePoint {
  t: number // seconds from start, integer
  price: number
}

export interface NormalizedSchedule {
  input: ScheduleInput
  points: SchedulePoint[]
  errors: string[]
}

function validateInput(input: ScheduleInput): string[] {
  const errors: string[] = []
  if (!Number.isFinite(input.startPrice) || input.startPrice <= 0) {
    errors.push('Start price must be a positive number')
  }
  if (!Number.isFinite(input.floorPrice) || input.floorPrice < 0) {
    errors.push('Floor price must be a non-negative number')
  }
  if (input.startPrice <= input.floorPrice) {
    errors.push('Start price must be greater than floor price')
  }
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    errors.push('Duration must be greater than 0')
  }
  if (!Number.isFinite(input.intervalSeconds) || input.intervalSeconds <= 0) {
    errors.push('Interval must be greater than 0')
  }
  if (input.durationSeconds % input.intervalSeconds !== 0) {
    errors.push('Interval must divide duration exactly')
  }
  if (input.decayType !== 'linear' && input.decayType !== 'exponential') {
    errors.push('Decay type must be linear or exponential')
  }
  return errors
}

export function computeSchedule(input: ScheduleInput): NormalizedSchedule {
  const errors = validateInput(input)
  const points: SchedulePoint[] = []

  const stepCount = Math.round(input.durationSeconds / input.intervalSeconds)
  if (errors.length === 0) {
    const start = input.startPrice
    const floor = input.floorPrice
    const totalSteps = stepCount

    if (input.decayType === 'linear') {
      const decrementPerStep = (start - floor) / totalSteps
      for (let i = 0; i <= totalSteps; i++) {
        const t = i * input.intervalSeconds
        const price = Math.max(floor, start - decrementPerStep * i)
        points.push({ t, price })
      }
    } else {
      // exponential decay towards floor: p(t) = floor + (start-floor)*exp(-k*t)
      // solve k so that p(duration) == floor (+ epsilon)
      // We want near floor at end; choose target factor f ~ 0.01
      const remainingFraction = 0.01
      const k = -Math.log(remainingFraction) / input.durationSeconds
      for (let i = 0; i <= totalSteps; i++) {
        const t = i * input.intervalSeconds
        const price = floor + (start - floor) * Math.exp(-k * t)
        points.push({ t, price })
      }
      // ensure last point equals exact floor
      const lastIndex = points.length - 1
      if (lastIndex >= 0) points[lastIndex] = { t: input.durationSeconds, price: floor }
    }
  }

  return { input, points, errors }
}

export function priceAtTime(input: ScheduleInput, secondsFromStart: number): number | null {
  const { errors } = computeSchedule(input)
  if (errors.length > 0) return null
  if (secondsFromStart <= 0) return input.startPrice
  if (secondsFromStart >= input.durationSeconds) return input.floorPrice

  if (input.decayType === 'linear') {
    const slope = (input.floorPrice - input.startPrice) / input.durationSeconds
    return input.startPrice + slope * secondsFromStart
  }

  const remainingFraction = 0.01
  const k = -Math.log(remainingFraction) / input.durationSeconds
  return input.floorPrice + (input.startPrice - input.floorPrice) * Math.exp(-k * secondsFromStart)
}

