import { describe, expect, it } from 'vitest';

import {
  BLIP_HALF_LIFE_ROTATIONS,
  blipAlpha,
  isBearingSwept,
  MIN_BLIP_ALPHA,
  normalizeDeg,
  pruneBlips,
  sweepAdvanceDeg,
} from './sweep.js';
import type { Blip } from './sweep.js';

const PERIOD_MS = 4800;

function blipPaintedAt(paintedAtMs: number): Blip {
  return {
    icaoHex: 'a1b2c3',
    position: { trueBearingDeg: 90, rangeNm: 10 },
    paintedAtMs,
    isEmergency: false,
  };
}

describe('sweepAdvanceDeg', () => {
  it('turns in proportion to the elapsed time', () => {
    expect(sweepAdvanceDeg(1200, PERIOD_MS)).toBe(90);
    expect(sweepAdvanceDeg(16, PERIOD_MS)).toBeCloseTo(1.2);
    expect(sweepAdvanceDeg(1200, 12_000)).toBe(36);
  });

  it('caps a long gap at one full turn rather than spinning to catch up', () => {
    expect(sweepAdvanceDeg(PERIOD_MS, PERIOD_MS)).toBe(360);
    expect(sweepAdvanceDeg(60_000, PERIOD_MS)).toBe(360);
  });

  it('does not turn for no time, negative time, or a nonsensical period', () => {
    expect(sweepAdvanceDeg(0, PERIOD_MS)).toBe(0);
    expect(sweepAdvanceDeg(-5, PERIOD_MS)).toBe(0);
    expect(sweepAdvanceDeg(100, 0)).toBe(0);
  });
});

describe('normalizeDeg', () => {
  it('wraps any angle into 0-360', () => {
    expect(normalizeDeg(370)).toBe(10);
    expect(normalizeDeg(-10)).toBe(350);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(725)).toBe(5);
    expect(normalizeDeg(45)).toBe(45);
  });
});

describe('isBearingSwept', () => {
  it('is true for a bearing inside the arc the beam just turned through', () => {
    expect(isBearingSwept(45, 0, 90)).toBe(true);
    expect(isBearingSwept(180, 0, 90)).toBe(false);
  });

  it('excludes the start of the arc and includes its end, so frames never overlap or leave gaps', () => {
    expect(isBearingSwept(0, 0, 90)).toBe(false);
    expect(isBearingSwept(90, 0, 90)).toBe(true);
    expect(isBearingSwept(90, 90, 90)).toBe(false);
  });

  it('handles the beam passing through north', () => {
    expect(isBearingSwept(5, 350, 20)).toBe(true);
    expect(isBearingSwept(355, 350, 20)).toBe(true);
    expect(isBearingSwept(340, 350, 20)).toBe(false);
    expect(isBearingSwept(15, 350, 20)).toBe(false);
  });

  it('is false when the beam did not turn and true for a full turn', () => {
    expect(isBearingSwept(45, 45, 0)).toBe(false);
    expect(isBearingSwept(45, 0, -10)).toBe(false);
    expect(isBearingSwept(200, 45, 360)).toBe(true);
    expect(isBearingSwept(45, 45, 360)).toBe(true);
  });
});

describe('blipAlpha', () => {
  it('is fully bright when just painted, or for a nonsensical negative age', () => {
    expect(blipAlpha(0, PERIOD_MS)).toBe(1);
    expect(blipAlpha(-100, PERIOD_MS)).toBe(1);
  });

  it('halves every half-life, which is a fraction of the rotation period', () => {
    const halfLifeMs = PERIOD_MS * BLIP_HALF_LIFE_ROTATIONS;

    expect(blipAlpha(halfLifeMs, PERIOD_MS)).toBeCloseTo(0.5);
    expect(blipAlpha(halfLifeMs * 2, PERIOD_MS)).toBeCloseTo(0.25);
  });

  it('is still visible one rotation later, so a moving target leaves a trail', () => {
    expect(blipAlpha(PERIOD_MS, PERIOD_MS)).toBeGreaterThan(MIN_BLIP_ALPHA);
  });

  it('fades at the same rate per rotation whatever the rotation period', () => {
    expect(blipAlpha(12_000, 12_000)).toBeCloseTo(blipAlpha(PERIOD_MS, PERIOD_MS));
  });
});

describe('pruneBlips', () => {
  it('keeps blips still bright enough to draw and drops the rest', () => {
    const fresh = blipPaintedAt(10_000);
    const lastRotation = blipPaintedAt(10_000 - PERIOD_MS);
    const ancient = blipPaintedAt(10_000 - PERIOD_MS * 5);

    expect(pruneBlips([ancient, lastRotation, fresh], 10_000, PERIOD_MS)).toEqual([
      lastRotation,
      fresh,
    ]);
  });

  it('returns an empty list unchanged', () => {
    expect(pruneBlips([], 10_000, PERIOD_MS)).toEqual([]);
  });
});
