import { describe, it, expect } from 'vitest';
import { deriveFlightCategory } from './flight-category.js';
import type { SkyCondition } from './types/index.js';

describe('deriveFlightCategory', () => {
  it('returns VFR for high ceiling and good visibility', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'FEW', altitudeFtAgl: 25000 }] };
    expect(deriveFlightCategory(10, false, sky, false)).toBe('VFR');
  });

  it('returns MVFR for ceiling 1000-3000 ft', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'BKN', altitudeFtAgl: 2000 }] };
    expect(deriveFlightCategory(10, false, sky, false)).toBe('MVFR');
  });

  it('returns MVFR for visibility 3-5 SM', () => {
    const sky: SkyCondition = { layers: [] };
    expect(deriveFlightCategory(4, false, sky, false)).toBe('MVFR');
  });

  it('returns IFR for ceiling 500-999 ft', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'OVC', altitudeFtAgl: 800 }] };
    expect(deriveFlightCategory(10, false, sky, false)).toBe('IFR');
  });

  it('returns IFR for visibility 1-2 SM', () => {
    const sky: SkyCondition = { layers: [] };
    expect(deriveFlightCategory(2, false, sky, false)).toBe('IFR');
  });

  it('returns LIFR for ceiling below 500 ft', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'OVC', altitudeFtAgl: 200 }] };
    expect(deriveFlightCategory(10, false, sky, false)).toBe('LIFR');
  });

  it('returns LIFR for visibility below 1 SM', () => {
    const sky: SkyCondition = { layers: [] };
    expect(deriveFlightCategory(0.5, false, sky, false)).toBe('LIFR');
  });

  it('returns most restrictive of ceiling and visibility', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'OVC', altitudeFtAgl: 300 }] };
    expect(deriveFlightCategory(4, false, sky, false)).toBe('LIFR');
  });

  it('returns VFR for CAVOK', () => {
    const sky: SkyCondition = { layers: [] };
    expect(deriveFlightCategory(undefined, false, sky, true)).toBe('VFR');
  });

  it('uses vertical visibility as ceiling', () => {
    const sky: SkyCondition = { layers: [], verticalVisibilityFtAgl: 500 };
    expect(deriveFlightCategory(10, false, sky, false)).toBe('IFR');
  });

  it('ignores FEW and SCT for ceiling determination', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'SCT', altitudeFtAgl: 500 }] };
    expect(deriveFlightCategory(10, false, sky, false)).toBe('VFR');
  });

  it('returns undefined when no data available', () => {
    const sky: SkyCondition = { layers: [] };
    expect(deriveFlightCategory(undefined, false, sky, false)).toBe(undefined);
  });

  it('handles isLessThan correctly at boundary', () => {
    const sky: SkyCondition = { layers: [] };
    // 1 SM with isLessThan should be LIFR (less than 1 SM)
    expect(deriveFlightCategory(1, true, sky, false)).toBe('LIFR');
  });
});
