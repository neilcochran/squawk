import { describe, it, expect, assert } from 'vitest';

import {
  cprNumLongitudeZones,
  decodeAirborneCprPair,
  decodeAirborneCprWithReference,
  decodeSurfaceCprPair,
  decodeSurfaceCprWithReference,
} from './cpr.js';
import type { CprPosition, CprReference } from './types/index.js';

const CPR_DENOMINATOR = 131072;

function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** Test-only inverse of the CPR encoding, for round-tripping known truth positions through the decoder. */
function encodeAirborneCpr(lat: number, lon: number, format: 'even' | 'odd'): CprPosition {
  const dLat = format === 'odd' ? 360 / 59 : 360 / 60;
  const latCprFraction = mod(lat, dLat) / dLat;
  const latCpr = Math.round(latCprFraction * CPR_DENOMINATOR) % CPR_DENOMINATOR;

  const ni = Math.max(cprNumLongitudeZones(lat) - (format === 'odd' ? 1 : 0), 1);
  const dLon = 360 / ni;
  const lonCprFraction = mod(lon, dLon) / dLon;
  const lonCpr = Math.round(lonCprFraction * CPR_DENOMINATOR) % CPR_DENOMINATOR;

  return { latCpr, lonCpr };
}

function encodeSurfaceCpr(lat: number, lon: number, format: 'even' | 'odd'): CprPosition {
  const dLat = format === 'odd' ? 90 / 59 : 90 / 60;
  const latCprFraction = mod(lat, dLat) / dLat;
  const latCpr = Math.round(latCprFraction * CPR_DENOMINATOR) % CPR_DENOMINATOR;

  const ni = Math.max(cprNumLongitudeZones(lat) - (format === 'odd' ? 1 : 0), 1);
  const dLon = 90 / ni;
  const lonCprFraction = mod(lon, dLon) / dLon;
  const lonCpr = Math.round(lonCprFraction * CPR_DENOMINATOR) % CPR_DENOMINATOR;

  return { latCpr, lonCpr };
}

describe('cprNumLongitudeZones', () => {
  it('is 59 at the equator', () => {
    expect(cprNumLongitudeZones(0)).toBe(59);
  });

  it('is 2 at exactly +-87 degrees', () => {
    expect(cprNumLongitudeZones(87)).toBe(2);
    expect(cprNumLongitudeZones(-87)).toBe(2);
  });

  it('is 1 beyond +-87 degrees', () => {
    expect(cprNumLongitudeZones(87.5)).toBe(1);
    expect(cprNumLongitudeZones(-89)).toBe(1);
  });

  it('is symmetric across hemispheres', () => {
    expect(cprNumLongitudeZones(43.5)).toBe(cprNumLongitudeZones(-43.5));
  });

  it('decreases monotonically with increasing absolute latitude', () => {
    const samples = [0, 10, 20, 30, 40, 50, 60, 70, 80];
    const nls = samples.map((lat) => cprNumLongitudeZones(lat));
    for (let i = 1; i < nls.length; i++) {
      const current = nls[i];
      const previous = nls[i - 1];
      assert(current !== undefined && previous !== undefined);
      expect(current).toBeLessThanOrEqual(previous);
    }
  });
});

describe('decodeAirborneCprPair', () => {
  it.each([
    ['mid-latitude coastal US', 43.54, -70.74],
    ['equator', 0.5, 10.2],
    ['high northern latitude', 78.3, 25.6],
    ['southern hemisphere', -33.9, 151.2],
    ['near the date line', 21.3, 179.4],
  ])('round-trips a synthetic %s position through an even/odd pair', (_label, lat, lon) => {
    const even = encodeAirborneCpr(lat, lon, 'even');
    const odd = encodeAirborneCpr(lat, lon, 'odd');
    const result = decodeAirborneCprPair(even, odd, 'even');
    expect(result).toBeDefined();
    expect(result?.lat).toBeCloseTo(lat, 2);
    expect(result?.lon).toBeCloseTo(lon, 2);
  });

  it('reports the position in the odd frame\'s zone when the odd frame is newer', () => {
    const even = encodeAirborneCpr(43.54, -70.74, 'even');
    const odd = encodeAirborneCpr(43.54, -70.74, 'odd');
    const result = decodeAirborneCprPair(even, odd, 'odd');
    expect(result?.lat).toBeCloseTo(43.54, 2);
    expect(result?.lon).toBeCloseTo(-70.74, 2);
  });

  it('returns undefined when the even and odd frames fall in different NL zones', () => {
    // Raw values chosen (by search, not hand-derivation) so the pair's
    // shared-j computation lands each frame's latitude on opposite sides of
    // an NL zone boundary near -60 degrees, while both stay in-range - this
    // exercises the zone-consistency guard specifically, as opposed to the
    // separate out-of-range guard below.
    const even: CprPosition = { latCpr: 0, lonCpr: 0 };
    const odd: CprPosition = { latCpr: 22931, lonCpr: 0 };
    expect(decodeAirborneCprPair(even, odd, 'even')).toBeUndefined();
  });

  it('returns undefined when the pair resolves to a physically impossible position', () => {
    // Two unrelated positions can still pass the NL-consistency check above
    // (it is a lightweight guard, not a foolproof validator - documented as
    // such in the reference implementation this was ported from) while the
    // resulting latitude or longitude lands outside the valid range.
    const even = encodeAirborneCpr(0.1, 10, 'even');
    const odd = encodeAirborneCpr(0.1, 10, 'odd');
    const corruptedOdd = { ...odd, latCpr: (odd.latCpr + 65536) % 131072 };
    expect(decodeAirborneCprPair(even, corruptedOdd, 'even')).toBeUndefined();
  });
});

describe('decodeAirborneCprWithReference', () => {
  it.each([
    ['even', 43.54, -70.74] as const,
    ['odd', 43.54, -70.74] as const,
    ['even', -33.9, 151.2] as const,
  ])('round-trips a synthetic %s-format position given an exact reference', (format, lat, lon) => {
    const frame = encodeAirborneCpr(lat, lon, format);
    const reference: CprReference = { lat, lon };
    const result = decodeAirborneCprWithReference(format, frame, reference);
    expect(result.lat).toBeCloseTo(lat, 2);
    expect(result.lon).toBeCloseTo(lon, 2);
  });

  it('normalizes a result past the antimeridian back into [-180, 180) instead of returning e.g. 180.5', () => {
    // Regression test: an earlier version of this function had no
    // longitude-wraparound step at all (unlike decodeAirborneCprPair,
    // which does), so a position just past the dateline would decode to
    // an out-of-range value like 180.5 instead of the equivalent -179.5.
    const trueLon = -179.5;
    const frame = encodeAirborneCpr(43.54, trueLon, 'even');
    const reference: CprReference = { lat: 43.54, lon: 179.0 };
    const result = decodeAirborneCprWithReference('even', frame, reference);
    expect(result.lon).toBeGreaterThanOrEqual(-180);
    expect(result.lon).toBeLessThan(180);
    expect(result.lon).toBeCloseTo(trueLon, 2);
  });

  it('recovers the true position from a reference that is off by a small amount', () => {
    const frame = encodeAirborneCpr(43.54, -70.74, 'even');
    const reference: CprReference = { lat: 43.5, lon: -70.7 };
    const result = decodeAirborneCprWithReference('even', frame, reference);
    expect(result.lat).toBeCloseTo(43.54, 2);
    expect(result.lon).toBeCloseTo(-70.74, 2);
  });

  it('falls back to a full 360 degree longitude zone at an odd-format pole where NL - 1 is 0', () => {
    const frame = encodeAirborneCpr(89.9, 10, 'odd');
    const reference: CprReference = { lat: 89.9, lon: 10 };
    const result = decodeAirborneCprWithReference('odd', frame, reference);
    expect(Number.isFinite(result.lat)).toBe(true);
    expect(Number.isFinite(result.lon)).toBe(true);
  });
});

describe('decodeSurfaceCprPair', () => {
  it('round-trips a synthetic surface position near the reference', () => {
    const even = encodeSurfaceCpr(43.54, -70.74, 'even');
    const odd = encodeSurfaceCpr(43.54, -70.74, 'odd');
    const reference: CprReference = { lat: 43.5, lon: -70.7 };
    const result = decodeSurfaceCprPair(even, odd, 'even', reference);
    expect(result?.lat).toBeCloseTo(43.54, 2);
    expect(result?.lon).toBeCloseTo(-70.74, 2);
  });

  it('resolves the correct hemisphere from the reference position', () => {
    const even = encodeSurfaceCpr(-33.9, 151.2, 'even');
    const odd = encodeSurfaceCpr(-33.9, 151.2, 'odd');
    const reference: CprReference = { lat: -33.87, lon: 151.21 };
    const result = decodeSurfaceCprPair(even, odd, 'odd', reference);
    expect(result?.lat).toBeCloseTo(-33.9, 1);
    expect(result?.lon).toBeCloseTo(151.2, 1);
  });

  it('returns undefined when the even and odd frames fall in different NL zones', () => {
    const even: CprPosition = { latCpr: 1994, lonCpr: 0 };
    const odd: CprPosition = { latCpr: 17946, lonCpr: 0 };
    const reference: CprReference = { lat: 0, lon: 0 };
    expect(decodeSurfaceCprPair(even, odd, 'even', reference)).toBeUndefined();
  });
});

describe('decodeSurfaceCprWithReference', () => {
  it('round-trips a synthetic surface position given an exact reference', () => {
    const frame = encodeSurfaceCpr(43.54, -70.74, 'even');
    const reference: CprReference = { lat: 43.54, lon: -70.74 };
    const result = decodeSurfaceCprWithReference('even', frame, reference);
    expect(result.lat).toBeCloseTo(43.54, 2);
    expect(result.lon).toBeCloseTo(-70.74, 2);
  });

  it('normalizes a result past the antimeridian back into [-180, 180)', () => {
    // Same regression as decodeAirborneCprWithReference's dateline test,
    // but with a much smaller reference-to-truth gap: surface CPR's zone
    // width (90/ni) is roughly a quarter of airborne's (360/ni) at the
    // same latitude, so the reference must stay well within its tighter
    // ~45 NM tolerance for the "closest lattice point" search to land on
    // the intended zone rather than an unrelated one.
    const trueLon = -179.98;
    const frame = encodeSurfaceCpr(43.54, trueLon, 'even');
    const reference: CprReference = { lat: 43.54, lon: 179.98 };
    const result = decodeSurfaceCprWithReference('even', frame, reference);
    expect(result.lon).toBeGreaterThanOrEqual(-180);
    expect(result.lon).toBeLessThan(180);
    expect(result.lon).toBeCloseTo(trueLon, 2);
  });

  it('falls back to a full 90 degree longitude zone at an odd-format pole where NL - 1 is 0', () => {
    const frame = encodeSurfaceCpr(89.9, 10, 'odd');
    const reference: CprReference = { lat: 89.9, lon: 10 };
    const result = decodeSurfaceCprWithReference('odd', frame, reference);
    expect(Number.isFinite(result.lat)).toBe(true);
    expect(Number.isFinite(result.lon)).toBe(true);
  });
});

// Raw CPR fields below were extracted by hand from a real even/odd DF17
// airborne-position message pair (type code 11) in a live Beast-binary
// capture off a real dump1090-fa station, 440ms apart for the same
// aircraft - not synthetic. Message hex, for reference:
//   even: 8dab096958c90106e9199e88d1a5
//   odd:  8dab096958c7f48b117e58d9b508
// The decoded position (~43.54N, ~70.74W) lands in the same coastal
// New Hampshire / Maine area as the real SBS capture fixtures already
// checked into sbs-mapping.spec.ts, which is the expected station location.
describe('decodeAirborneCprPair - real dump1090-fa Beast capture', () => {
  it('decodes a real even/odd position pair to a physically plausible position', () => {
    const even: CprPosition = { latCpr: 33652, lonCpr: 72094 };
    const odd: CprPosition = { latCpr: 17800, lonCpr: 97880 };
    const result = decodeAirborneCprPair(even, odd, 'even');
    expect(result).toBeDefined();
    expect(result?.lat).toBeCloseTo(43.540466, 5);
    expect(result?.lon).toBeCloseTo(-70.743905, 5);
  });

  it('agrees closely regardless of which frame in the pair is treated as newer', () => {
    const even: CprPosition = { latCpr: 33652, lonCpr: 72094 };
    const odd: CprPosition = { latCpr: 17800, lonCpr: 97880 };
    const asEvenNewer = decodeAirborneCprPair(even, odd, 'even');
    const asOddNewer = decodeAirborneCprPair(even, odd, 'odd');
    expect(asEvenNewer).toBeDefined();
    expect(asOddNewer).toBeDefined();
    if (asEvenNewer === undefined || asOddNewer === undefined) {
      return;
    }
    expect(Math.abs(asEvenNewer.lat - asOddNewer.lat)).toBeLessThan(0.01);
    expect(Math.abs(asEvenNewer.lon - asOddNewer.lon)).toBeLessThan(0.01);
  });
});
