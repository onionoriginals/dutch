import { describe, test, expect } from 'bun:test'
import { DateTime } from 'luxon'
import {
  toISOInUTCFromLocalParts,
  parseISOToZone,
  isBefore
} from '../utils/datetime'

describe('DST-safe time handling', () => {
  test('spring forward nonexistent time is nudged forward', () => {
    // America/New_York 2024-03-10 02:30 does not exist
    const iso = toISOInUTCFromLocalParts('2024-03-10', '02:30', 'America/New_York')
    const dtLocal = parseISOToZone(iso, 'America/New_York')
    // Should be at or after 03:00 local
    expect(dtLocal.hour > 2).toBe(true)
  })

  test('fall back repeated hour preserves ordering', () => {
    // Two times around the fallback
    const before = toISOInUTCFromLocalParts('2024-11-03', '01:30', 'America/New_York')
    const after = toISOInUTCFromLocalParts('2024-11-03', '01:45', 'America/New_York')
    expect(isBefore(before, after)).toBe(true)
  })
})

