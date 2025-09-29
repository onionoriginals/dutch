import { describe, it, expect } from 'bun:test'
import { computeSchedule, priceAtTime } from '../schedule'

describe('schedule math', () => {
  it('validates inputs', () => {
    const bad = computeSchedule({ startPrice: 1, floorPrice: 2, durationSeconds: 60, intervalSeconds: 7, decayType: 'linear' })
    expect(bad.errors.length).toBeGreaterThan(0)
  })

  it('linear schedule hits exact floor at end and steps correctly', () => {
    const s = computeSchedule({ startPrice: 100, floorPrice: 10, durationSeconds: 100, intervalSeconds: 20, decayType: 'linear' })
    expect(s.errors).toEqual([])
    expect(s.points[0]!.price).toBe(100)
    expect(s.points[s.points.length - 1]!.price).toBe(10)
    // decrement per step: (100-10)/5 = 18
    expect(s.points.map(p => p.price)).toEqual([100, 82, 64, 46, 28, 10])
  })

  it('exponential schedule starts at start and ends at floor', () => {
    const s = computeSchedule({ startPrice: 1000, floorPrice: 100, durationSeconds: 60, intervalSeconds: 10, decayType: 'exponential' })
    expect(s.errors).toEqual([])
    expect(s.points[0]!.price).toBeCloseTo(1000, 10)
    expect(s.points[s.points.length - 1]!.price).toBe(100)
    // monotonic decreasing
    for (let i = 1; i < s.points.length; i++) {
      expect(s.points[i]!.price).toBeLessThanOrEqual(s.points[i - 1]!.price)
    }
  })

  it('priceAtTime matches linear closed form', () => {
    const input = { startPrice: 200, floorPrice: 20, durationSeconds: 180, intervalSeconds: 30, decayType: 'linear' as const }
    const p0 = priceAtTime(input, 0)!
    const pHalf = priceAtTime(input, 90)!
    const pEnd = priceAtTime(input, 180)!
    expect(p0).toBe(200)
    expect(pHalf).toBeCloseTo(110, 10)
    expect(pEnd).toBe(20)
  })
})

