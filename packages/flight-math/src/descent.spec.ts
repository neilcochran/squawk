import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import { descent } from './index.js';

describe('topOfDescent', () => {
  it('computes TOD for a 3-degree glidepath', () => {
    // From 10,000 ft to 2,000 ft on a 3-degree path.
    // 8,000 ft / (tan(3) * 6076.11549) = ~25.1 NM
    const tod = descent.topOfDescent(10000, 2000, 3);
    assert.ok(close(tod, 25.1, 0.2), `expected ~25.1 NM, got ${tod}`);
  });

  it('returns zero when already at target altitude', () => {
    const tod = descent.topOfDescent(5000, 5000, 3);
    assert.ok(close(tod, 0, 0.001), `expected 0, got ${tod}`);
  });

  it('increases distance with a shallower angle', () => {
    const steep = descent.topOfDescent(10000, 0, 5);
    const shallow = descent.topOfDescent(10000, 0, 2);
    assert.ok(shallow > steep, `expected shallow (${shallow}) > steep (${steep})`);
  });
});

describe('topOfDescentFromRate', () => {
  it('computes TOD from a rate and groundspeed', () => {
    // 5,000 ft to lose at 500 fpm, 120 kt GS.
    // Time = 5000/500 = 10 min. Distance = 120 * 10/60 = 20 NM.
    const tod = descent.topOfDescentFromRate(7000, 2000, 500, 120);
    assert.ok(close(tod, 20, 0.01), `expected 20 NM, got ${tod}`);
  });

  it('returns zero when already at target altitude', () => {
    const tod = descent.topOfDescentFromRate(5000, 5000, 500, 120);
    assert.ok(close(tod, 0, 0.001), `expected 0, got ${tod}`);
  });
});

describe('requiredDescentRate', () => {
  it('computes required descent rate', () => {
    // 20 NM to go, 5000 ft to lose, 120 kt GS.
    // Time = 20/120 * 60 = 10 min. Rate = 5000/10 = 500 fpm.
    const rate = descent.requiredDescentRate(20, 7000, 2000, 120);
    assert.ok(close(rate, 500, 0.1), `expected 500 fpm, got ${rate}`);
  });

  it('returns higher rate for shorter distance', () => {
    const short = descent.requiredDescentRate(10, 10000, 5000, 120);
    const long = descent.requiredDescentRate(30, 10000, 5000, 120);
    assert.ok(short > long, `expected short distance rate (${short}) > long (${long})`);
  });
});

describe('requiredClimbRate', () => {
  it('computes required climb rate', () => {
    // 15 NM to go, 3000 ft to gain, 90 kt GS.
    // Time = 15/90 * 60 = 10 min. Rate = 3000/10 = 300 fpm.
    const rate = descent.requiredClimbRate(15, 2000, 5000, 90);
    assert.ok(close(rate, 300, 0.1), `expected 300 fpm, got ${rate}`);
  });
});

describe('verticalSpeedToGradient', () => {
  it('converts vertical speed to a flight path angle', () => {
    // At 120 kt GS: horizontal = 120 * 6076.11549/60 = 12152.2 fpm.
    // 500 fpm / 12152.2 fpm = tan(angle), angle = ~2.36 degrees.
    const grad = descent.verticalSpeedToGradient(500, 120);
    assert.ok(close(grad, 2.36, 0.05), `expected ~2.36 deg, got ${grad}`);
  });

  it('returns zero for zero vertical speed', () => {
    const grad = descent.verticalSpeedToGradient(0, 120);
    assert.ok(close(grad, 0, 0.001), `expected 0, got ${grad}`);
  });
});

describe('gradientToVerticalSpeed', () => {
  it('converts a gradient to vertical speed', () => {
    // 3 degrees at 120 kt GS.
    const vs = descent.gradientToVerticalSpeed(3, 120);
    assert.ok(vs > 600 && vs < 650, `expected 600-650 fpm at 3 deg/120kt, got ${vs}`);
  });

  it('round-trips with verticalSpeedToGradient', () => {
    const originalVs = 750;
    const gs = 150;
    const grad = descent.verticalSpeedToGradient(originalVs, gs);
    const roundTripped = descent.gradientToVerticalSpeed(grad, gs);
    assert.ok(
      close(roundTripped, originalVs, 0.01),
      `expected ~${originalVs}, got ${roundTripped}`,
    );
  });
});

describe('visualDescentPoint', () => {
  it('computes VDP for a 3-degree glidepath', () => {
    // 300 ft TCH at 3 degrees.
    // 300 / (tan(3) * 6076.11549) = ~0.942 NM
    const vdp = descent.visualDescentPoint(3, 300);
    assert.ok(close(vdp, 0.942, 0.01), `expected ~0.94 NM, got ${vdp}`);
  });

  it('increases with higher threshold crossing height', () => {
    const low = descent.visualDescentPoint(3, 200);
    const high = descent.visualDescentPoint(3, 400);
    assert.ok(high > low, `expected high TCH (${high}) > low TCH (${low})`);
  });
});
