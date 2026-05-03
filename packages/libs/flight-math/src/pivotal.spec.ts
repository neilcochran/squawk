import { describe, it, assert } from 'vitest';

import { close } from './test-utils.js';

import { pivotal } from './index.js';

describe('pivotalAltitude', () => {
  it('computes pivotal altitude for a typical GA speed', () => {
    // 100 kt: 100^2 / 11.3 = ~885 ft AGL.
    const pa = pivotal.pivotalAltitude(100);
    assert(close(pa, 885, 1), `expected ~885 ft, got ${pa}`);
  });

  it('increases with the square of groundspeed', () => {
    const slow = pivotal.pivotalAltitude(80);
    const fast = pivotal.pivotalAltitude(120);
    // 120^2/80^2 = 2.25, so fast should be 2.25x slow.
    assert(close(fast / slow, 2.25, 0.01), `expected ratio 2.25, got ${fast / slow}`);
  });

  it('returns zero at zero groundspeed', () => {
    assert(close(pivotal.pivotalAltitude(0), 0, 0.001));
  });

  it('returns a reasonable value for a faster aircraft', () => {
    // 150 kt: 150^2 / 11.3 = ~1991 ft AGL.
    const pa = pivotal.pivotalAltitude(150);
    assert(close(pa, 1991, 2), `expected ~1991 ft, got ${pa}`);
  });
});
