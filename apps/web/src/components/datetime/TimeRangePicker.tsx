import React, { useId, useMemo } from 'react'
import { DateTime } from 'luxon'
import type { IsoString } from '../../utils/datetime'
import {
  listTimezones,
  toISOInUTCFromLocalParts,
  decomposeISOInZone,
  isBefore,
  clampStartToMin,
  formatLocalPreview,
  minTimeForSelectedDate
} from '../../utils/datetime'

export type TimeRangeValue = {
  startISO: IsoString
  endISO: IsoString
  timezone: string
}

export type TimeRangePickerProps = {
  value: TimeRangeValue
  onChange: (next: TimeRangeValue) => void
  minStartISO?: IsoString
  timezones?: string[]
  locale?: string
  disablePastStart?: boolean
}

export function TimeRangePicker({ value, onChange, minStartISO, timezones, locale, disablePastStart = true }: TimeRangePickerProps) {
  const tzOptions = useMemo(() => listTimezones(timezones), [timezones])
  const ids = {
    tz: useId(),
    sd: useId(),
    st: useId(),
    ed: useId(),
    et: useId()
  }

  const startParts = decomposeISOInZone(value.startISO, value.timezone)
  const endParts = decomposeISOInZone(value.endISO, value.timezone)

  const effectiveMinStart = useMemo(() => {
    const nowISO = DateTime.utc().toISO({ suppressMilliseconds: true }) as IsoString
    const base = disablePastStart ? (minStartISO ? (isBefore(minStartISO, nowISO) ? nowISO : minStartISO) : nowISO) : (minStartISO || undefined)
    return base
  }, [disablePastStart, minStartISO])

  const startMinTime = minTimeForSelectedDate(startParts.date, effectiveMinStart, value.timezone)

  function updateStart(date: string, time: string) {
    const nextStart = toISOInUTCFromLocalParts(date, time, value.timezone)
    const clampedStart = effectiveMinStart ? clampStartToMin(nextStart, effectiveMinStart) : nextStart
    let nextEnd = value.endISO
    if (!nextEnd || !isBefore(clampedStart, nextEnd)) {
      // Ensure end > start by defaulting to +1 hour in the same zone
      const endDT = DateTime.fromISO(clampedStart).plus({ hours: 1 })
      nextEnd = endDT.toISO({ suppressMilliseconds: true }) as IsoString
    }
    onChange({ ...value, startISO: clampedStart, endISO: nextEnd })
  }

  function updateEnd(date: string, time: string) {
    const nextEnd = toISOInUTCFromLocalParts(date, time, value.timezone)
    // Enforce end > start; if not, nudge by +1 minute
    const fixedEnd = isBefore(value.startISO, nextEnd)
      ? nextEnd
      : DateTime.fromISO(value.startISO).plus({ minutes: 1 }).toISO({ suppressMilliseconds: true }) as IsoString
    onChange({ ...value, endISO: fixedEnd })
  }

  function updateTimezone(tz: string) {
    // Re-interpret local wall times in the new timezone to produce ISO UTC
    const sp = decomposeISOInZone(value.startISO, tz)
    const ep = decomposeISOInZone(value.endISO, tz)
    const newStartISO = toISOInUTCFromLocalParts(sp.date, sp.time, tz)
    const newEndISO = toISOInUTCFromLocalParts(ep.date, ep.time, tz)
    const clampedStart = effectiveMinStart ? clampStartToMin(newStartISO, effectiveMinStart) : newStartISO
    const fixedEnd = isBefore(clampedStart, newEndISO)
      ? newEndISO
      : DateTime.fromISO(clampedStart).plus({ minutes: 1 }).toISO({ suppressMilliseconds: true }) as IsoString
    onChange({ startISO: clampedStart, endISO: fixedEnd, timezone: tz })
  }

  const startError = effectiveMinStart && isBefore(value.startISO, effectiveMinStart)
    ? `Start must be after ${formatLocalPreview(effectiveMinStart, locale)}`
    : undefined
  const endError = value.endISO && !isBefore(value.startISO, value.endISO)
    ? 'End must be after start'
    : undefined

  return (
    <fieldset>
      <legend>Time Range</legend>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label htmlFor={ids.tz}>Timezone</label>
          <select id={ids.tz} value={value.timezone} onChange={e => updateTimezone(e.target.value)}>
            {tzOptions.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div aria-live="polite" style={{ justifySelf: 'end', fontSize: '0.9em' }}>
          Local preview: {formatLocalPreview(value.startISO, locale)} → {formatLocalPreview(value.endISO, locale)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '0.75rem' }}>
        <div>
          <label htmlFor={ids.sd}>Start date</label>
          <input
            id={ids.sd}
            type="date"
            value={startParts.date}
            onChange={e => updateStart(e.target.value, startParts.time)}
            aria-invalid={Boolean(startError)}
          />
        </div>
        <div>
          <label htmlFor={ids.st}>Start time</label>
          <input
            id={ids.st}
            type="time"
            value={startParts.time}
            min={startMinTime}
            onChange={e => updateStart(startParts.date, e.target.value)}
            aria-invalid={Boolean(startError)}
          />
          {startError && <div role="alert" style={{ color: 'crimson' }}>{startError}</div>}
        </div>

        <div>
          <label htmlFor={ids.ed}>End date</label>
          <input
            id={ids.ed}
            type="date"
            value={endParts.date}
            onChange={e => updateEnd(e.target.value, endParts.time)}
            aria-invalid={Boolean(endError)}
          />
        </div>
        <div>
          <label htmlFor={ids.et}>End time</label>
          <input
            id={ids.et}
            type="time"
            value={endParts.time}
            onChange={e => updateEnd(endParts.date, e.target.value)}
            aria-invalid={Boolean(endError)}
          />
          {endError && <div role="alert" style={{ color: 'crimson' }}>{endError}</div>}
        </div>
      </div>
    </fieldset>
  )
}

export default TimeRangePicker

