import type { Position } from '@squawk/types';

import type { CprPosition, CprReference } from './types/index.js';

/** Raw CPR fields are 17-bit, normalized to [0, 1) by dividing by 2^17. */
const CPR_DENOMINATOR = 131072;

/**
 * Latitude boundaries (absolute degrees, ascending) where the number of CPR
 * longitude zones (NL) steps down by one. Entry `i` is the latitude at
 * which NL transitions from `59 - i` to `59 - i - 1`. Derived once from the
 * closed-form NL(lat) trigonometric expression in ICAO Annex 10 Vol. IV /
 * RTCA DO-260B SS A.1.7.2 with the fixed `nz = 15` zone count - stable
 * across releases since the formula has no other free parameters. A static
 * table avoids repeated trig evaluation on every position decode.
 */
const NL_BOUNDARIES: readonly number[] = [
  10.47047129996848, 14.828174368686794, 18.186263570713354, 21.029394926028463,
  23.545044865570706, 25.829247070587755, 27.938987101219045, 29.911356857318083,
  31.77209707681077, 33.53993436298484, 35.22899597796385, 36.85025107593526,
  38.41241892412256, 39.922566843338615, 41.38651832260239, 42.80914012243555,
  44.194549514192744, 45.546267226602346, 46.867332524987454, 48.160391280966216,
  49.42776439255687, 50.67150165553835, 51.893424691687684, 53.09516152796003,
  54.278174722729, 55.44378444495043, 56.59318756205918, 57.72747353866114,
  58.84763776148457, 59.954592766940294, 61.04917774246351, 62.13216659210329,
  63.20427479381928, 64.2661652256744, 65.31845309682089, 66.36171008382617,
  67.39646774084667, 68.4232202208333, 69.44242631144024, 70.454510749876,
  71.45986473028982, 72.45884544728945, 73.45177441667865, 74.43893415725137,
  75.42056256653356, 76.39684390794469, 77.36789461328188, 78.33374082922747,
  79.29428225456925, 80.24923213280512, 81.19801349271948, 82.13956980510606,
  83.07199444719814, 83.99173562980565, 84.89166190702085, 85.75541620944418,
  86.535369975121, 87.0,
];

/** True modulo (JS `%` can return a negative result; CPR math requires the mathematical modulo). */
function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** Wraps a longitude in degrees into the canonical [-180, 180) range. Longitude is circular, so a raw interpolated value outside that range (e.g. 180.5) represents a valid position (-179.5), not an error. */
function normalizeLongitudeDeg(lonDeg: number): number {
  return mod(lonDeg + 180, 360) - 180;
}

/**
 * Returns the number of CPR longitude zones (NL) at a given latitude, per
 * ICAO Annex 10 Vol. IV / RTCA DO-260B SS A.1.7.2. NL is 1-59, monotone
 * non-increasing in absolute latitude: 59 at the equator, 2 at +-87 deg, 1
 * beyond +-87 deg.
 *
 * @param latDeg - Latitude in decimal degrees.
 * @returns The number of longitude zones, 1-59.
 */
export function cprNumLongitudeZones(latDeg: number): number {
  const absLat = Math.abs(latDeg);
  if (absLat > 87) {
    return 1;
  }
  if (absLat === 87) {
    return 2;
  }
  const idx = NL_BOUNDARIES.findIndex((boundary) => boundary > absLat);
  return 59 - idx;
}

/**
 * Shared core of the even/odd pair decoders: checks the two frames land in
 * consistent NL zones, then interpolates the longitude fraction within
 * `latSpanDeg` (360 for airborne, 90 for surface). Both pair decoders
 * resolve latitude differently before calling this (surface needs an extra
 * hemisphere disambiguation step airborne doesn't), but the zone-check and
 * longitude interpolation that follows is identical modulo the span.
 */
function resolveCprPairLongitude(
  latSpanDeg: number,
  latEven: number,
  latOdd: number,
  cprLonEven: number,
  cprLonOdd: number,
  newerFormat: 'even' | 'odd',
): { lat: number; lonFraction: number } | undefined {
  const nlEven = cprNumLongitudeZones(latEven);
  const nlOdd = cprNumLongitudeZones(latOdd);
  if (nlEven !== nlOdd) {
    return undefined;
  }

  const lat = newerFormat === 'even' ? latEven : latOdd;
  const nl = newerFormat === 'even' ? nlEven : nlOdd;
  const ni = newerFormat === 'even' ? Math.max(nl, 1) : Math.max(nl - 1, 1);
  const m = Math.floor(cprLonEven * (nl - 1) - cprLonOdd * nl + 0.5);
  const cprLonForFormat = newerFormat === 'even' ? cprLonEven : cprLonOdd;
  const lonFraction = (latSpanDeg / ni) * (mod(m, ni) + cprLonForFormat);

  return { lat, lonFraction };
}

/**
 * Shared core of the single-frame-plus-reference decoders: resolves
 * latitude and longitude within `latSpanDeg` (360 for airborne, 90 for
 * surface) against a known nearby reference position.
 */
function decodeCprWithReference(
  latSpanDeg: number,
  format: 'even' | 'odd',
  frame: CprPosition,
  reference: CprReference,
): Position {
  const cprLat = frame.latCpr / CPR_DENOMINATOR;
  const cprLon = frame.lonCpr / CPR_DENOMINATOR;
  const dLat = format === 'odd' ? latSpanDeg / 59 : latSpanDeg / 60;

  const j = Math.floor(0.5 + reference.lat / dLat - cprLat);
  const lat = dLat * (j + cprLat);

  const ni = cprNumLongitudeZones(lat) - (format === 'odd' ? 1 : 0);
  const dLon = ni > 0 ? latSpanDeg / ni : latSpanDeg;

  const m = Math.floor(0.5 + reference.lon / dLon - cprLon);
  const lon = normalizeLongitudeDeg(dLon * (m + cprLon));

  return { lat, lon };
}

/**
 * Resolves an absolute position from a paired even and odd airborne CPR
 * frame (ADS-B BDS 0,5 / 2,0 - type codes 9-18 and 20-22), per DO-260B SS
 * A.1.7.3. The two frames must be close enough in time that the aircraft
 * could not have crossed a latitude zone boundary - in practice, no more
 * than about 10 seconds apart, since airborne position is broadcast at
 * roughly 2 Hz. Enforcing that window is the caller's responsibility; this
 * function only performs a zone-consistency check as a lightweight guard,
 * which cannot by itself detect a same-zone false positive from a pair
 * spanning too wide a gap.
 *
 * @param even - Raw CPR fields from the even-format (F=0) frame.
 * @param odd - Raw CPR fields from the odd-format (F=1) frame.
 * @param newerFormat - Which frame is more recent - determines which frame's latitude zone the result is reported in.
 * @returns The resolved position, or undefined if the two frames fall in different latitude zones (the pair cannot be combined) or the result is physically impossible.
 */
export function decodeAirborneCprPair(
  even: CprPosition,
  odd: CprPosition,
  newerFormat: 'even' | 'odd',
): Position | undefined {
  const cprLatEven = even.latCpr / CPR_DENOMINATOR;
  const cprLonEven = even.lonCpr / CPR_DENOMINATOR;
  const cprLatOdd = odd.latCpr / CPR_DENOMINATOR;
  const cprLonOdd = odd.lonCpr / CPR_DENOMINATOR;

  const j = Math.floor(59 * cprLatEven - 60 * cprLatOdd + 0.5);
  let latEven = (360 / 60) * (mod(j, 60) + cprLatEven);
  let latOdd = (360 / 59) * (mod(j, 59) + cprLatOdd);
  if (latEven >= 270) {
    latEven -= 360;
  }
  if (latOdd >= 270) {
    latOdd -= 360;
  }

  const resolved = resolveCprPairLongitude(360, latEven, latOdd, cprLonEven, cprLonOdd, newerFormat);
  if (resolved === undefined) {
    return undefined;
  }

  // A frame pair that passes the zone-consistency check above but still
  // produces an out-of-range latitude is a straddling-boundary false
  // positive - reject rather than report a physically impossible
  // position. Longitude has no equivalent failure mode: the interpolation
  // formula is bounded to one span by construction, and
  // normalizeLongitudeDeg always yields a valid [-180, 180) result.
  if (Math.abs(resolved.lat) > 90) {
    return undefined;
  }

  return { lat: resolved.lat, lon: normalizeLongitudeDeg(resolved.lonFraction) };
}

/**
 * Resolves an absolute position from a single airborne CPR frame plus a
 * known nearby reference position, per DO-260B SS A.1.7.5. The reference
 * must be within roughly 180 NM of the true position - typically the
 * aircraft's own last known position, or the receiver's location as a
 * fallback for the first message from a new aircraft.
 *
 * @param format - Whether `frame` is an even (F=0) or odd (F=1) format frame.
 * @param frame - Raw CPR fields from the frame.
 * @param reference - A position known to be near the frame's true position.
 * @returns The resolved position.
 */
export function decodeAirborneCprWithReference(
  format: 'even' | 'odd',
  frame: CprPosition,
  reference: CprReference,
): Position {
  return decodeCprWithReference(360, format, frame, reference);
}

/**
 * Resolves an absolute position from a paired even and odd surface CPR
 * frame (ADS-B BDS 0,6 - type codes 5-8), per DO-260B SS A.1.7.4. Surface
 * CPR spans a 90 degree latitude zone (versus 360 degree for airborne) and
 * is ambiguous across four longitude quadrants, so unlike the airborne
 * pair decode, a reference position is required to resolve the correct
 * hemisphere and quadrant - the receiver's own location is normally used.
 *
 * @param even - Raw CPR fields from the even-format frame.
 * @param odd - Raw CPR fields from the odd-format frame.
 * @param newerFormat - Which frame is more recent.
 * @param reference - A position known to be within about 45 NM of the true position (typically the receiver's location).
 * @returns The resolved position, or undefined if the two frames fall in different latitude zones.
 */
export function decodeSurfaceCprPair(
  even: CprPosition,
  odd: CprPosition,
  newerFormat: 'even' | 'odd',
  reference: CprReference,
): Position | undefined {
  const cprLatEven = even.latCpr / CPR_DENOMINATOR;
  const cprLonEven = even.lonCpr / CPR_DENOMINATOR;
  const cprLatOdd = odd.latCpr / CPR_DENOMINATOR;
  const cprLonOdd = odd.lonCpr / CPR_DENOMINATOR;

  const j = Math.floor(59 * cprLatEven - 60 * cprLatOdd + 0.5);
  const latEvenNorth = (90 / 60) * (mod(j, 60) + cprLatEven);
  const latOddNorth = (90 / 59) * (mod(j, 59) + cprLatOdd);
  const latEvenSouth = latEvenNorth - 90;
  const latOddSouth = latOddNorth - 90;

  // Surface CPR is ambiguous over two 90 degree latitude zones (north and
  // south of the equator) - resolve using whichever zone's newer-frame
  // latitude lands closer to the reference, rather than the reference's own
  // hemisphere (a receiver and aircraft can be on opposite sides of the
  // equator while still satisfying the 45 NM limit).
  const newerLatNorth = newerFormat === 'even' ? latEvenNorth : latOddNorth;
  const newerLatSouth = newerFormat === 'even' ? latEvenSouth : latOddSouth;
  const useNorth =
    Math.abs(reference.lat - newerLatNorth) <= Math.abs(reference.lat - newerLatSouth);
  const latEven = useNorth ? latEvenNorth : latEvenSouth;
  const latOdd = useNorth ? latOddNorth : latOddSouth;

  const resolved = resolveCprPairLongitude(90, latEven, latOdd, cprLonEven, cprLonOdd, newerFormat);
  if (resolved === undefined) {
    return undefined;
  }

  // Surface longitude only narrows to one of four 90 degree quadrants -
  // pick whichever wraps closest to the reference, treating longitude as
  // circular (near the date line, -180 is one degree from +179, not 359).
  let bestLon = resolved.lonFraction;
  let bestLonDiff = Number.POSITIVE_INFINITY;
  for (const quadrantOffset of [0, 90, 180, 270]) {
    const candidateLon = normalizeLongitudeDeg(resolved.lonFraction + quadrantOffset);
    const diff = Math.abs(normalizeLongitudeDeg(candidateLon - reference.lon));
    if (diff < bestLonDiff) {
      bestLonDiff = diff;
      bestLon = candidateLon;
    }
  }

  return { lat: resolved.lat, lon: bestLon };
}

/**
 * Resolves an absolute position from a single surface CPR frame plus a
 * known nearby reference position, per DO-260B SS A.1.7.6. The reference
 * must be within roughly 45 NM of the true position - typically the
 * receiver's own location, since surface traffic is by definition close to
 * an airport the receiver can see.
 *
 * @param format - Whether `frame` is an even (F=0) or odd (F=1) format frame.
 * @param frame - Raw CPR fields from the frame.
 * @param reference - A position known to be near the frame's true position.
 * @returns The resolved position.
 */
export function decodeSurfaceCprWithReference(
  format: 'even' | 'odd',
  frame: CprPosition,
  reference: CprReference,
): Position {
  return decodeCprWithReference(90, format, frame, reference);
}
