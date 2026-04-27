/**
 * World Magnetic Model 2025 (WMM2025) computation engine.
 *
 * Implements the spherical harmonic expansion algorithm to compute magnetic
 * declination, inclination, and field components at any geographic position
 * and date within the model validity window (2025.0 - 2030.0).
 *
 * @see https://www.ncei.noaa.gov/products/world-magnetic-model
 */

import type { MagneticFieldOptions, MagneticFieldResult } from './types/magnetic.js';
import { WMM2025_COEFFICIENTS, WMM_MAX_DEGREE } from './wmm-coefficients.js';

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

/** WMM2025 model epoch (decimal year). */
export const WMM_EPOCH = 2025.0;

/** Start of the WMM2025 validity window (decimal year). */
export const WMM_VALID_START = 2025.0;

/** End of the WMM2025 validity window (decimal year). */
export const WMM_VALID_END = 2030.0;

// ---------------------------------------------------------------------------
// Private constants
// ---------------------------------------------------------------------------

/** WGS-84 semi-major axis in km. */
const WGS84_A = 6378.137;

/** WGS-84 flattening. */
const WGS84_F = 1 / 298.257223563;

/** WGS-84 first eccentricity squared. */
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

/** WMM reference sphere radius in km. */
const WMM_REFERENCE_RADIUS = 6371.2;

/** Conversion factor from feet to kilometers. */
const FT_TO_KM = 0.0003048;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Small angle to clamp colatitude away from poles (avoids division by zero). */
const POLE_EPSILON = 1e-10;

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Computes the magnetic declination at a geographic position using the
 * World Magnetic Model 2025 (WMM2025).
 *
 * Declination is the angle between true north and magnetic north. A positive
 * value means magnetic north is east of true north; negative means west.
 *
 * @param latDeg - Geodetic latitude in decimal degrees (-90 to 90).
 * @param lonDeg - Geodetic longitude in decimal degrees (-180 to 180).
 * @param options - Optional altitude and date.
 * @returns Magnetic declination in degrees (positive east, negative west).
 *
 * @example
 * ```ts
 * import { magnetic } from '@squawk/flight-math';
 *
 * // Declination at Boulder, CO on Jan 1 2025
 * const dec = magnetic.magneticDeclination(40.0, -105.0, {
 *   date: new Date(Date.UTC(2025, 0, 1)),
 * });
 * ```
 */
export function magneticDeclination(
  latDeg: number,
  lonDeg: number,
  options?: MagneticFieldOptions,
): number {
  return magneticField(latDeg, lonDeg, options).declinationDeg;
}

/**
 * Computes the full magnetic field at a geographic position using the
 * World Magnetic Model 2025 (WMM2025).
 *
 * Returns declination, inclination, and all field components (X, Y, Z, H, F).
 *
 * @param latDeg - Geodetic latitude in decimal degrees (-90 to 90).
 * @param lonDeg - Geodetic longitude in decimal degrees (-180 to 180).
 * @param options - Optional altitude and date.
 * @returns Full magnetic field result with all components.
 *
 * @example
 * ```ts
 * import { magnetic } from '@squawk/flight-math';
 *
 * const result = magnetic.magneticField(40.0, -105.0, {
 *   date: new Date(Date.UTC(2026, 0, 1)),
 * });
 * console.log(result.declinationDeg);
 * console.log(result.totalIntensityNt);
 * ```
 */
export function magneticField(
  latDeg: number,
  lonDeg: number,
  options?: MagneticFieldOptions,
): MagneticFieldResult {
  const altKm = (options?.altitudeFt ?? 0) * FT_TO_KM;
  const decimalYear = options?.decimalYear ?? dateToDecimalYear(options?.date ?? new Date());

  return computeField(latDeg, lonDeg, altKm, decimalYear);
}

/**
 * Converts a true bearing to a magnetic bearing by subtracting the magnetic
 * declination at the given position. The result is normalized to [0, 360).
 *
 * @param trueBearingDeg - True bearing in degrees.
 * @param latDeg - Geodetic latitude in decimal degrees.
 * @param lonDeg - Geodetic longitude in decimal degrees.
 * @param options - Optional altitude and date.
 * @returns Magnetic bearing in degrees, normalized to [0, 360).
 *
 * @example
 * ```ts
 * import { magnetic } from '@squawk/flight-math';
 *
 * // Convert a true heading of 360 to magnetic at a given position
 * const magHeading = magnetic.trueToMagnetic(360, 40.0, -105.0);
 * ```
 */
export function trueToMagnetic(
  trueBearingDeg: number,
  latDeg: number,
  lonDeg: number,
  options?: MagneticFieldOptions,
): number {
  const dec = magneticDeclination(latDeg, lonDeg, options);
  return normalizeDeg(trueBearingDeg - dec);
}

/**
 * Converts a magnetic bearing to a true bearing by adding the magnetic
 * declination at the given position. The result is normalized to [0, 360).
 *
 * @param magneticBearingDeg - Magnetic bearing in degrees.
 * @param latDeg - Geodetic latitude in decimal degrees.
 * @param lonDeg - Geodetic longitude in decimal degrees.
 * @param options - Optional altitude and date.
 * @returns True bearing in degrees, normalized to [0, 360).
 *
 * @example
 * ```ts
 * import { magnetic } from '@squawk/flight-math';
 *
 * // Convert a magnetic heading of 350 to true at a given position
 * const trueHeading = magnetic.magneticToTrue(350, 40.0, -105.0);
 * ```
 */
export function magneticToTrue(
  magneticBearingDeg: number,
  latDeg: number,
  lonDeg: number,
  options?: MagneticFieldOptions,
): number {
  const dec = magneticDeclination(latDeg, lonDeg, options);
  return normalizeDeg(magneticBearingDeg + dec);
}

/**
 * Converts a JavaScript Date to a decimal year (e.g. 2025-07-02 becomes
 * approximately 2025.5).
 *
 * @param date - The date to convert.
 * @returns Decimal year representation.
 */
export function dateToDecimalYear(date: Date): number {
  const year = date.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const jan1Next = Date.UTC(year + 1, 0, 1);
  const msInYear = jan1Next - jan1;
  const elapsed = date.getTime() - jan1;
  return year + elapsed / msInYear;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes an angle in degrees to the range [0, 360).
 */
function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Geocentric spherical coordinates derived from geodetic input.
 */
interface SphericalCoords {
  /** Geocentric radius in km. */
  r: number;
  /** Geocentric colatitude in radians (0 at north pole, PI at south pole). */
  theta: number;
  /** Geocentric longitude in radians. */
  phi: number;
  /** Difference: geodetic latitude - geocentric latitude, in radians. */
  latDiffRad: number;
}

/**
 * Converts geodetic coordinates to geocentric spherical coordinates.
 */
function geodeticToSpherical(latDeg: number, lonDeg: number, altKm: number): SphericalCoords {
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);

  // Radius of curvature in the prime vertical
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  // ECEF Cartesian coordinates
  const x = (n + altKm) * cosLat * Math.cos(lonRad);
  const y = (n + altKm) * cosLat * Math.sin(lonRad);
  const z = (n * (1 - WGS84_E2) + altKm) * sinLat;

  // Geocentric spherical
  const r = Math.sqrt(x * x + y * y + z * z);
  const geocentricLatRad = Math.asin(z / r);
  const latDiffRad = latRad - geocentricLatRad;

  // Colatitude (0 at north pole), clamped away from exact poles
  let theta = Math.PI / 2 - geocentricLatRad;
  if (theta < POLE_EPSILON) {
    theta = POLE_EPSILON;
  } else if (theta > Math.PI - POLE_EPSILON) {
    theta = Math.PI - POLE_EPSILON;
  }

  return { r, theta, phi: lonRad, latDiffRad };
}

/**
 * Computes Schmidt semi-normalized associated Legendre polynomials P[n][m]
 * and their derivatives dP[n][m] with respect to colatitude, up to the
 * given maximum degree.
 */
function computeLegendre(nMax: number, theta: number): { p: number[][]; dp: number[][] } {
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);

  const size = nMax + 1;
  const p: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const dp: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));

  // Seed values
  p[0]![0] = 1;
  dp[0]![0] = 0;

  // n=1 special cases (the diagonal recursion factor does not apply for n=1)
  p[1]![0] = cosTheta;
  dp[1]![0] = -sinTheta;
  p[1]![1] = sinTheta;
  dp[1]![1] = cosTheta;

  // Build the table for n >= 2
  for (let n = 2; n <= nMax; n++) {
    // Diagonal: P[n][n]
    const diagFactor = Math.sqrt((2 * n - 1) / (2 * n));
    p[n]![n] = sinTheta * p[n - 1]![n - 1]! * diagFactor;
    dp[n]![n] = (cosTheta * p[n - 1]![n - 1]! + sinTheta * dp[n - 1]![n - 1]!) * diagFactor;

    // Sub-diagonal: P[n][n-1]
    const subFactor = Math.sqrt(2 * n - 1);
    p[n]![n - 1] = cosTheta * p[n - 1]![n - 1]! * subFactor;
    dp[n]![n - 1] = (cosTheta * dp[n - 1]![n - 1]! - sinTheta * p[n - 1]![n - 1]!) * subFactor;

    // Remaining orders: m = 0 to n-2
    for (let m = 0; m <= n - 2; m++) {
      const num = 2 * n - 1;
      const denom = Math.sqrt(n * n - m * m);
      const prevFactor = Math.sqrt((n - 1) * (n - 1) - m * m);

      p[n]![m] = (num * cosTheta * p[n - 1]![m]! - prevFactor * p[n - 2]![m]!) / denom;
      dp[n]![m] =
        (num * (cosTheta * dp[n - 1]![m]! - sinTheta * p[n - 1]![m]!) -
          prevFactor * dp[n - 2]![m]!) /
        denom;
    }
  }

  return { p, dp };
}

/**
 * Core WMM field computation.
 */
function computeField(
  latDeg: number,
  lonDeg: number,
  altKm: number,
  decimalYear: number,
): MagneticFieldResult {
  const { r, theta, phi, latDiffRad } = geodeticToSpherical(latDeg, lonDeg, altKm);
  const { p, dp } = computeLegendre(WMM_MAX_DEGREE, theta);

  const dt = decimalYear - WMM_EPOCH;

  // Precompute cos(m*phi) and sin(m*phi)
  const cosMPhi = new Array<number>(WMM_MAX_DEGREE + 1);
  const sinMPhi = new Array<number>(WMM_MAX_DEGREE + 1);
  for (let m = 0; m <= WMM_MAX_DEGREE; m++) {
    cosMPhi[m] = Math.cos(m * phi);
    sinMPhi[m] = Math.sin(m * phi);
  }

  // Precompute (a/r)^(n+2) for each degree; max needed index is nMax + 2
  const arRatio = WMM_REFERENCE_RADIUS / r;
  const arPow = new Array<number>(WMM_MAX_DEGREE + 3);
  arPow[0] = 1;
  for (let i = 1; i <= WMM_MAX_DEGREE + 2; i++) {
    arPow[i] = arPow[i - 1]! * arRatio;
  }

  // Sum the spherical harmonic series in geocentric coordinates
  let bR = 0; // radial (positive outward)
  let bTheta = 0; // south (positive toward south pole)
  let bPhi = 0; // east (positive east)

  for (const coeff of WMM2025_COEFFICIENTS) {
    const { n, m, gnm, hnm, dgnm, dhnm } = coeff;

    // Time-adjusted coefficients
    const g = gnm + dgnm * dt;
    const h = hnm + dhnm * dt;

    const scale = arPow[n + 2]!; // (a/r)^(n+2)
    const pnm = p[n]![m]!;
    const dpnm = dp[n]![m]!;
    const cosM = cosMPhi[m]!;
    const sinM = sinMPhi[m]!;

    const ghCos = g * cosM + h * sinM;
    const ghSin = -g * sinM + h * cosM;

    bR += (n + 1) * scale * ghCos * pnm;
    bTheta -= scale * ghCos * dpnm;
    bPhi -= (scale * m * ghSin * pnm) / Math.sin(theta);
  }

  // Rotate from geocentric spherical to geodetic (North-East-Down)
  const sinD = Math.sin(latDiffRad);
  const cosD = Math.cos(latDiffRad);

  const x = -bTheta * cosD - bR * sinD; // North
  const y = bPhi; // East
  const z = bTheta * sinD - bR * cosD; // Down (positive into Earth)

  const h2 = Math.sqrt(x * x + y * y);
  const f = Math.sqrt(h2 * h2 + z * z);
  const declinationDeg = Math.atan2(y, x) * RAD_TO_DEG;
  const inclinationDeg = Math.atan2(z, h2) * RAD_TO_DEG;

  return {
    declinationDeg,
    inclinationDeg,
    horizontalIntensityNt: h2,
    northIntensityNt: x,
    eastIntensityNt: y,
    downIntensityNt: z,
    totalIntensityNt: f,
    decimalYear,
  };
}
