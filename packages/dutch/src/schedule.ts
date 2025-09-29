export type DecayType = 'linear' | 'exponential';

export interface ScheduleInput {
  startPrice: number; // inclusive at t=0
  floorPrice: number; // inclusive at t=duration
  durationMs: number; // total duration in milliseconds
  intervalMs: number; // step size in milliseconds (must divide duration)
  decay: DecayType;
}

export interface SchedulePoint {
  tMs: number; // from 0..durationMs
  price: number; // normalized number (no rounding here)
}

export interface NormalizedSchedule {
  points: SchedulePoint[];
  getPriceAt: (tMs: number) => number;
}

export interface ValidationError {
  field: keyof ScheduleInput;
  message: string;
}

export function validateScheduleInput(input: ScheduleInput): ValidationError[] {
  const errors: ValidationError[] = [];
  const { startPrice, floorPrice, durationMs, intervalMs } = input;
  if (!Number.isFinite(startPrice) || startPrice <= 0) {
    errors.push({ field: 'startPrice', message: 'Start price must be a positive number' });
  }
  if (!Number.isFinite(floorPrice) || floorPrice < 0) {
    errors.push({ field: 'floorPrice', message: 'Floor price must be a non-negative number' });
  }
  if (Number.isFinite(startPrice) && Number.isFinite(floorPrice) && startPrice <= floorPrice) {
    errors.push({ field: 'startPrice', message: 'Start price must be greater than floor price' });
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    errors.push({ field: 'durationMs', message: 'Duration must be greater than 0' });
  }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    errors.push({ field: 'intervalMs', message: 'Interval must be greater than 0' });
  }
  if (Number.isFinite(durationMs) && Number.isFinite(intervalMs) && durationMs % intervalMs !== 0) {
    errors.push({ field: 'intervalMs', message: 'Interval must evenly divide duration' });
  }
  return errors;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computePriceAt(input: ScheduleInput, tMs: number): number {
  const errors = validateScheduleInput(input);
  if (errors.length) throw new Error(errors[0].message);
  const { startPrice, floorPrice, durationMs, decay } = input;
  const clamped = clamp(tMs, 0, durationMs);
  if (clamped === 0) return startPrice;
  if (clamped === durationMs) return floorPrice;
  const progress = clamped / durationMs; // 0..1
  const delta = startPrice - floorPrice;
  if (decay === 'linear') {
    return startPrice - delta * progress;
  }
  // exponential: price(t) = floor + (start - floor) * exp(-k * progress), choose k so end hits floor
  // We want price(1) = floor approximately; choose k large so it nearly reaches floor.
  // Alternatively define by half-life so price decays smoothly to floor and clamp end to floor.
  const k = 5; // aggressiveness of exponential decay (higher -> faster drop)
  const price = floorPrice + delta * Math.exp(-k * progress);
  return price;
}

export function generateSchedulePoints(input: ScheduleInput): SchedulePoint[] {
  const errors = validateScheduleInput(input);
  if (errors.length) throw new Error(errors[0].message);
  const { durationMs, intervalMs } = input;
  const points: SchedulePoint[] = [];
  for (let t = 0; t <= durationMs; t += intervalMs) {
    const price = computePriceAt(input, t);
    points.push({ tMs: t, price });
  }
  // ensure last point at exact duration
  if (points[points.length - 1]?.tMs !== durationMs) {
    points.push({ tMs: durationMs, price: computePriceAt(input, durationMs) });
  }
  return points;
}

export function normalizeSchedule(input: ScheduleInput): NormalizedSchedule {
  const points = generateSchedulePoints(input);
  return {
    points,
    getPriceAt: (tMs: number) => computePriceAt(input, tMs)
  };
}

