import { describe, it, assert } from 'vitest';
import { close } from './test-utils.js';
import { glide } from './index.js';

describe('glideDistance', () => {
  it('computes glide distance for a known ratio', () => {
    // 5000 ft AGL, 10:1 glide ratio = 50,000 ft = ~8.23 NM.
    const d = glide.glideDistance(5000, 10);
    assert(close(d, 8.23, 0.01), `expected ~8.23 NM, got ${d}`);
  });

  it('returns zero at zero altitude', () => {
    assert(close(glide.glideDistance(0, 10), 0, 0.001));
  });

  it('increases with altitude', () => {
    const low = glide.glideDistance(3000, 8);
    const high = glide.glideDistance(6000, 8);
    assert(close(high, low * 2, 0.001), `expected high (${high}) = 2 * low (${low})`);
  });

  it('increases with better glide ratio', () => {
    const poor = glide.glideDistance(5000, 8);
    const good = glide.glideDistance(5000, 12);
    assert(good > poor, `expected good ratio (${good}) > poor (${poor})`);
  });

  it('returns zero for zero glide ratio', () => {
    assert(close(glide.glideDistance(5000, 0), 0, 0.001));
  });

  it('returns negative distance for negative altitude (nonsensical but mathematically consistent)', () => {
    const d = glide.glideDistance(-1000, 10);
    assert(d < 0, `expected negative distance for negative altitude, got ${d}`);
  });
});

describe('glideDistanceWithWind', () => {
  it('matches no-wind distance when headwind is zero', () => {
    const noWind = glide.glideDistance(5000, 10);
    const withWind = glide.glideDistanceWithWind(5000, 10, 80, 0);
    assert(close(withWind, noWind, 0.001), `expected ${noWind}, got ${withWind}`);
  });

  it('reduces distance with a headwind', () => {
    const noWind = glide.glideDistance(5000, 10);
    const withHeadwind = glide.glideDistanceWithWind(5000, 10, 80, 20);
    assert(withHeadwind < noWind, `expected headwind (${withHeadwind}) < no wind (${noWind})`);
  });

  it('extends distance with a tailwind', () => {
    const noWind = glide.glideDistance(5000, 10);
    const withTailwind = glide.glideDistanceWithWind(5000, 10, 80, -20);
    assert(withTailwind > noWind, `expected tailwind (${withTailwind}) > no wind (${noWind})`);
  });

  it('scales correctly by groundspeed/TAS ratio', () => {
    // 80 kt TAS, 20 kt headwind: GS = 60, ratio = 60/80 = 0.75.
    const noWind = glide.glideDistance(5000, 10);
    const withWind = glide.glideDistanceWithWind(5000, 10, 80, 20);
    assert(close(withWind, noWind * 0.75, 0.001), `expected ${noWind * 0.75}, got ${withWind}`);
  });
});
