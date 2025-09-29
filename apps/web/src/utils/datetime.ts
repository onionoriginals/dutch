import { DateTime, IANAZone } from 'luxon'

export type IsoString = string

const COMMON_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney'
]

export function listTimezones(custom?: string[]): string[] {
  const localTz = DateTime.local().zoneName || 'UTC'
  const base = custom && custom.length ? custom : COMMON_TIMEZONES
  const merged = [localTz, ...base.filter(z => z !== localTz)]
  return merged.filter((z, i) => merged.indexOf(z) === i && IANAZone.isValidZone(z))
}

export function combineDateAndTime(datePart: string, timePart: string): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const [y = NaN, m = NaN, d = NaN] = (datePart || '').split('-').map(n => Number(n))
  const [hh = 0, mm = 0] = (timePart || '00:00').split(':').map(n => Number(n))
  return { year: y, month: m, day: d, hour: hh, minute: mm }
}

export function toISOInUTCFromLocalParts(datePart: string, timePart: string, zone: string): IsoString {
  const parts = combineDateAndTime(datePart, timePart)
  const dt = DateTime.fromObject(parts, { zone })
  if (!dt.isValid) {
    // For nonexistent local times (e.g., DST spring-forward gaps), shift forward 1 minute until valid
    let cursor = DateTime.fromObject({ ...parts, second: 0 }, { zone })
    while (!cursor.isValid) {
      cursor = cursor.plus({ minutes: 1 })
      if (cursor.diff(dt).as('hours') > 3) break
    }
    return cursor.toUTC().toISO({ suppressMilliseconds: true }) as IsoString
  }
  return dt.toUTC().toISO({ suppressMilliseconds: true }) as IsoString
}

export function parseISOToZone(iso: IsoString, zone: string) {
  const base = DateTime.fromISO(iso, { zone: 'utc' })
  return base.setZone(zone)
}

export function isBefore(aISO: IsoString, bISO: IsoString): boolean {
  const a = DateTime.fromISO(aISO, { zone: 'utc' }).toMillis()
  const b = DateTime.fromISO(bISO, { zone: 'utc' }).toMillis()
  return a < b
}

export function clampStartToMin(startISO: IsoString, minISO: IsoString): IsoString {
  return isBefore(startISO, minISO) ? minISO : startISO
}

export function formatLocalPreview(iso: IsoString, locale?: string): string {
  if (!iso) return ''
  const dt = DateTime.fromISO(iso).setLocale(locale || undefined)
  return dt.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)
}

export function ymd(date: ReturnType<typeof parseISOToZone>): string {
  const y = String(date.year).padStart(4, '0')
  const m = String(date.month).padStart(2, '0')
  const d = String(date.day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function hm(date: ReturnType<typeof parseISOToZone>): string {
  const h = String(date.hour).padStart(2, '0')
  const m = String(date.minute).padStart(2, '0')
  return `${h}:${m}`
}

export function decomposeISOInZone(iso: IsoString | null | undefined, zone: string): {
  date: string
  time: string
} {
  if (!iso) return { date: '', time: '' }
  const dt = parseISOToZone(iso, zone)
  return { date: ymd(dt), time: hm(dt) }
}

export function minTimeForSelectedDate(selectedDate: string, minISO: IsoString | undefined, zone: string): string | undefined {
  if (!selectedDate || !minISO) return undefined
  const min = parseISOToZone(minISO, zone)
  const sd = DateTime.fromISO(selectedDate, { zone })
  if (sd.year === min.year && sd.month === min.month && sd.day === min.day) {
    return hm(min)
  }
  return undefined
}

