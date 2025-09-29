export function helloDutch(name: string): string {
  return `Hallo, ${name}!`;
}

export const version = '0.1.0'

// Browser build intentionally omits database exports to avoid bun:sqlite
export { computeSchedule, priceAtTime } from './schedule'
export type { DecayType, ScheduleInput, NormalizedSchedule, SchedulePoint } from './schedule'
