import { describe, it, expect } from 'bun:test';
import { computePriceAt, generateSchedulePoints, validateScheduleInput } from '../schedule';

describe('Dutch schedule math', () => {
  it('validates inputs', () => {
    const errs = validateScheduleInput({ startPrice: 10, floorPrice: 20, durationMs: 1000, intervalMs: 100, decay: 'linear' });
    expect(errs.some(e => e.message.includes('greater than floor'))).toBe(true);
    const errs2 = validateScheduleInput({ startPrice: 10, floorPrice: 1, durationMs: 0, intervalMs: 100, decay: 'linear' });
    expect(errs2.some(e => e.field === 'durationMs')).toBe(true);
    const errs3 = validateScheduleInput({ startPrice: 10, floorPrice: 1, durationMs: 1000, intervalMs: 60, decay: 'linear' });
    expect(errs3.some(e => e.field === 'intervalMs')).toBe(true);
  });

  it('computes linear prices', () => {
    const input = { startPrice: 1000, floorPrice: 100, durationMs: 1000, intervalMs: 1000, decay: 'linear' } as const;
    expect(computePriceAt(input, 0)).toBe(1000);
    expect(computePriceAt(input, 500)).toBeCloseTo(550, 6);
    expect(computePriceAt(input, 1000)).toBe(100);
  });

  it('computes exponential prices monotically decreasing and bounded', () => {
    const input = { startPrice: 1000, floorPrice: 100, durationMs: 1000, intervalMs: 100, decay: 'exponential' } as const;
    let prev = computePriceAt(input, 0);
    for (let t = 100; t <= 1000; t += 100) {
      const p = computePriceAt(input, t);
      expect(p).toBeLessThan(prev);
      prev = p;
    }
    const last = computePriceAt(input, 1000);
    expect(last).toBeGreaterThanOrEqual(100);
    expect(last).toBeLessThan(1000);
  });

  it('generates stepped points inclusive of duration', () => {
    const input = { startPrice: 1000, floorPrice: 100, durationMs: 600, intervalMs: 200, decay: 'linear' } as const;
    const pts = generateSchedulePoints(input);
    expect(pts.map(p => p.tMs)).toEqual([0, 200, 400, 600]);
    expect(pts[0].price).toBe(1000);
    expect(pts[pts.length - 1].price).toBe(100);
  });
});

