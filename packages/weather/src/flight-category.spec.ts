import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveFlightCategory } from './flight-category.js';
import type { SkyCondition } from './types/index.js';

describe('deriveFlightCategory', () => {
  it('returns VFR for high ceiling and good visibility', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'FEW', altitudeFt: 25000 }] };
    assert.equal(deriveFlightCategory(10, false, sky, false), 'VFR');
  });

  it('returns MVFR for ceiling 1000-3000 ft', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'BKN', altitudeFt: 2000 }] };
    assert.equal(deriveFlightCategory(10, false, sky, false), 'MVFR');
  });

  it('returns MVFR for visibility 3-5 SM', () => {
    const sky: SkyCondition = { layers: [] };
    assert.equal(deriveFlightCategory(4, false, sky, false), 'MVFR');
  });

  it('returns IFR for ceiling 500-999 ft', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'OVC', altitudeFt: 800 }] };
    assert.equal(deriveFlightCategory(10, false, sky, false), 'IFR');
  });

  it('returns IFR for visibility 1-2 SM', () => {
    const sky: SkyCondition = { layers: [] };
    assert.equal(deriveFlightCategory(2, false, sky, false), 'IFR');
  });

  it('returns LIFR for ceiling below 500 ft', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'OVC', altitudeFt: 200 }] };
    assert.equal(deriveFlightCategory(10, false, sky, false), 'LIFR');
  });

  it('returns LIFR for visibility below 1 SM', () => {
    const sky: SkyCondition = { layers: [] };
    assert.equal(deriveFlightCategory(0.5, false, sky, false), 'LIFR');
  });

  it('returns most restrictive of ceiling and visibility', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'OVC', altitudeFt: 300 }] };
    assert.equal(deriveFlightCategory(4, false, sky, false), 'LIFR');
  });

  it('returns VFR for CAVOK', () => {
    const sky: SkyCondition = { layers: [] };
    assert.equal(deriveFlightCategory(undefined, false, sky, true), 'VFR');
  });

  it('uses vertical visibility as ceiling', () => {
    const sky: SkyCondition = { layers: [], verticalVisibilityFt: 500 };
    assert.equal(deriveFlightCategory(10, false, sky, false), 'IFR');
  });

  it('ignores FEW and SCT for ceiling determination', () => {
    const sky: SkyCondition = { layers: [{ coverage: 'SCT', altitudeFt: 500 }] };
    assert.equal(deriveFlightCategory(10, false, sky, false), 'VFR');
  });

  it('returns undefined when no data available', () => {
    const sky: SkyCondition = { layers: [] };
    assert.equal(deriveFlightCategory(undefined, false, sky, false), undefined);
  });

  it('handles isLessThan correctly at boundary', () => {
    const sky: SkyCondition = { layers: [] };
    // 1 SM with isLessThan should be LIFR (less than 1 SM)
    assert.equal(deriveFlightCategory(1, true, sky, false), 'LIFR');
  });
});
