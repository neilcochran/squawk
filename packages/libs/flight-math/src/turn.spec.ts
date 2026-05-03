import { describe, it, assert } from 'vitest';

import { close } from './test-utils.js';

import { turn } from './index.js';

describe('standardRateBankAngle', () => {
  it('returns a reasonable bank angle for typical GA speed', () => {
    // At 100 kt, standard rate bank is roughly 15-17 degrees.
    const bank = turn.standardRateBankAngle(100);
    assert(bank > 14 && bank < 18, `expected 14-18 deg, got ${bank}`);
  });

  it('increases with higher TAS', () => {
    const slow = turn.standardRateBankAngle(90);
    const fast = turn.standardRateBankAngle(200);
    assert(fast > slow, `expected fast (${fast}) > slow (${slow})`);
  });

  it('returns roughly 25 degrees at 170 kt', () => {
    // Common rule of thumb: standard rate bank ~ TAS/10 + 7, so ~24 deg at 170 kt.
    const bank = turn.standardRateBankAngle(170);
    assert(bank > 22 && bank < 28, `expected 22-28 deg, got ${bank}`);
  });
});

describe('turnRadius', () => {
  it('returns a positive radius', () => {
    const r = turn.turnRadius(120, 25);
    assert(r > 0, `expected positive radius, got ${r}`);
  });

  it('increases with higher TAS', () => {
    const slow = turn.turnRadius(90, 25);
    const fast = turn.turnRadius(180, 25);
    assert(fast > slow, `expected fast (${fast}) > slow (${slow})`);
  });

  it('decreases with steeper bank', () => {
    const shallow = turn.turnRadius(120, 15);
    const steep = turn.turnRadius(120, 30);
    assert(steep < shallow, `expected steep (${steep}) < shallow (${shallow})`);
  });

  it('returns a reasonable value for typical parameters', () => {
    // 120 kt at 25 degrees bank: roughly 0.5-0.8 NM radius.
    const r = turn.turnRadius(120, 25);
    assert(r > 0.3 && r < 1.0, `expected 0.3-1.0 NM, got ${r}`);
  });

  it('matches a known reference value', () => {
    // Turn radius formula: r = V^2 / (g * tan(bank)).
    // 100 kt = 168.78 ft/s. r = 168.78^2 / (32.174 * tan(30)) = 28492 / 18.574 = 1533.7 ft.
    // 1533.7 / 6076.11549 = 0.2524 NM.
    const r = turn.turnRadius(100, 30);
    assert(close(r, 0.2524, 0.001), `expected ~0.2524 NM, got ${r}`);
  });
});

describe('standardRateTurnRadius', () => {
  it('matches turnRadius at the standard rate bank angle', () => {
    const tas = 120;
    const bank = turn.standardRateBankAngle(tas);
    const expected = turn.turnRadius(tas, bank);
    const actual = turn.standardRateTurnRadius(tas);
    assert(close(actual, expected, 0.001), `expected ${expected}, got ${actual}`);
  });

  it('produces a radius consistent with 360 degrees in 2 minutes', () => {
    // At standard rate (3 deg/sec), a full turn takes 120 sec.
    // Circumference = TAS * time. Radius = circumference / (2 * pi).
    // 120 kt = 2 NM/min. Circumference = 2 * 2 = 4 NM. Radius = 4 / (2 * pi) = ~0.637 NM.
    const r = turn.standardRateTurnRadius(120);
    assert(close(r, 0.637, 0.01), `expected ~0.637 NM, got ${r}`);
  });
});

describe('timeToTurn', () => {
  it('computes time for a standard rate 360-degree turn', () => {
    // 360 degrees at 3 deg/sec = 120 seconds = 2 minutes.
    const t = turn.timeToTurn(360);
    assert(close(t, 120, 0.01), `expected 120 sec, got ${t}`);
  });

  it('computes time for a 90-degree turn', () => {
    const t = turn.timeToTurn(90);
    assert(close(t, 30, 0.01), `expected 30 sec, got ${t}`);
  });

  it('accepts a custom turn rate', () => {
    // 180 degrees at 1.5 deg/sec = 120 seconds.
    const t = turn.timeToTurn(180, 1.5);
    assert(close(t, 120, 0.01), `expected 120 sec, got ${t}`);
  });

  it('handles negative turn degrees (absolute value)', () => {
    const t = turn.timeToTurn(-90);
    assert(close(t, 30, 0.01), `expected 30 sec, got ${t}`);
  });
});

describe('loadFactor', () => {
  it('returns 1g at zero bank', () => {
    assert(close(turn.loadFactor(0), 1, 0.001));
  });

  it('returns 2g at 60 degrees bank', () => {
    assert(close(turn.loadFactor(60), 2, 0.001), `expected 2g, got ${turn.loadFactor(60)}`);
  });

  it('returns approximately 1.41g at 45 degrees bank', () => {
    const lf = turn.loadFactor(45);
    assert(close(lf, Math.SQRT2, 0.001), `expected ~1.414, got ${lf}`);
  });

  it('increases with bank angle', () => {
    const shallow = turn.loadFactor(20);
    const steep = turn.loadFactor(50);
    assert(steep > shallow, `expected steep (${steep}) > shallow (${shallow})`);
  });
});
