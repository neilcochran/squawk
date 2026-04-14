/**
 * WMM2025 spherical harmonic coefficients.
 *
 * Data sourced from the official WMM2025.COF file published by NOAA/NCEI.
 * The model epoch is 2025.0 and the coefficients are valid through 2030.0.
 *
 * @see https://www.ncei.noaa.gov/products/world-magnetic-model
 */

/** A single row of WMM spherical harmonic coefficients. */
export interface WmmCoefficient {
  /** Degree of the spherical harmonic (1-12). */
  readonly n: number;
  /** Order of the spherical harmonic (0-n). */
  readonly m: number;
  /** Main field coefficient g(n,m) in nanotesla (nT). */
  readonly gnm: number;
  /** Main field coefficient h(n,m) in nanotesla (nT). */
  readonly hnm: number;
  /** Secular variation of g(n,m) in nanotesla per year (nT/yr). */
  readonly dgnm: number;
  /** Secular variation of h(n,m) in nanotesla per year (nT/yr). */
  readonly dhnm: number;
}

/** Maximum spherical harmonic degree of the WMM2025 model. */
export const WMM_MAX_DEGREE = 12;

/** WMM2025 spherical harmonic coefficients from WMM2025.COF (epoch 2025.0). */
export const WMM2025_COEFFICIENTS: readonly WmmCoefficient[] = [
  { n: 1, m: 0, gnm: -29351.8, hnm: 0.0, dgnm: 12.0, dhnm: 0.0 },
  { n: 1, m: 1, gnm: -1410.8, hnm: 4545.4, dgnm: 9.7, dhnm: -21.5 },
  { n: 2, m: 0, gnm: -2556.6, hnm: 0.0, dgnm: -11.6, dhnm: 0.0 },
  { n: 2, m: 1, gnm: 2951.1, hnm: -3133.6, dgnm: -5.2, dhnm: -27.7 },
  { n: 2, m: 2, gnm: 1649.3, hnm: -815.1, dgnm: -8.0, dhnm: -12.1 },
  { n: 3, m: 0, gnm: 1361.0, hnm: 0.0, dgnm: -1.3, dhnm: 0.0 },
  { n: 3, m: 1, gnm: -2404.1, hnm: -56.6, dgnm: -4.2, dhnm: 4.0 },
  { n: 3, m: 2, gnm: 1243.8, hnm: 237.5, dgnm: 0.4, dhnm: -0.3 },
  { n: 3, m: 3, gnm: 453.6, hnm: -549.5, dgnm: -15.6, dhnm: -4.1 },
  { n: 4, m: 0, gnm: 895.0, hnm: 0.0, dgnm: -1.6, dhnm: 0.0 },
  { n: 4, m: 1, gnm: 799.5, hnm: 278.6, dgnm: -2.4, dhnm: -1.1 },
  { n: 4, m: 2, gnm: 55.7, hnm: -133.9, dgnm: -6.0, dhnm: 4.1 },
  { n: 4, m: 3, gnm: -281.1, hnm: 212.0, dgnm: 5.6, dhnm: 1.6 },
  { n: 4, m: 4, gnm: 12.1, hnm: -375.6, dgnm: -7.0, dhnm: -4.4 },
  { n: 5, m: 0, gnm: -233.2, hnm: 0.0, dgnm: 0.6, dhnm: 0.0 },
  { n: 5, m: 1, gnm: 368.9, hnm: 45.4, dgnm: 1.4, dhnm: -0.5 },
  { n: 5, m: 2, gnm: 187.2, hnm: 220.2, dgnm: 0.0, dhnm: 2.2 },
  { n: 5, m: 3, gnm: -138.7, hnm: -122.9, dgnm: 0.6, dhnm: 0.4 },
  { n: 5, m: 4, gnm: -142.0, hnm: 43.0, dgnm: 2.2, dhnm: 1.7 },
  { n: 5, m: 5, gnm: 20.9, hnm: 106.1, dgnm: 0.9, dhnm: 1.9 },
  { n: 6, m: 0, gnm: 64.4, hnm: 0.0, dgnm: -0.2, dhnm: 0.0 },
  { n: 6, m: 1, gnm: 63.8, hnm: -18.4, dgnm: -0.4, dhnm: 0.3 },
  { n: 6, m: 2, gnm: 76.9, hnm: 16.8, dgnm: 0.9, dhnm: -1.6 },
  { n: 6, m: 3, gnm: -115.7, hnm: 48.8, dgnm: 1.2, dhnm: -0.4 },
  { n: 6, m: 4, gnm: -40.9, hnm: -59.8, dgnm: -0.9, dhnm: 0.9 },
  { n: 6, m: 5, gnm: 14.9, hnm: 10.9, dgnm: 0.3, dhnm: 0.7 },
  { n: 6, m: 6, gnm: -60.7, hnm: 72.7, dgnm: 0.9, dhnm: 0.9 },
  { n: 7, m: 0, gnm: 79.5, hnm: 0.0, dgnm: -0.0, dhnm: 0.0 },
  { n: 7, m: 1, gnm: -77.0, hnm: -48.9, dgnm: -0.1, dhnm: 0.6 },
  { n: 7, m: 2, gnm: -8.8, hnm: -14.4, dgnm: -0.1, dhnm: 0.5 },
  { n: 7, m: 3, gnm: 59.3, hnm: -1.0, dgnm: 0.5, dhnm: -0.8 },
  { n: 7, m: 4, gnm: 15.8, hnm: 23.4, dgnm: -0.1, dhnm: 0.0 },
  { n: 7, m: 5, gnm: 2.5, hnm: -7.4, dgnm: -0.8, dhnm: -1.0 },
  { n: 7, m: 6, gnm: -11.1, hnm: -25.1, dgnm: -0.8, dhnm: 0.6 },
  { n: 7, m: 7, gnm: 14.2, hnm: -2.3, dgnm: 0.8, dhnm: -0.2 },
  { n: 8, m: 0, gnm: 23.2, hnm: 0.0, dgnm: -0.1, dhnm: 0.0 },
  { n: 8, m: 1, gnm: 10.8, hnm: 7.1, dgnm: 0.2, dhnm: -0.2 },
  { n: 8, m: 2, gnm: -17.5, hnm: -12.6, dgnm: 0.0, dhnm: 0.5 },
  { n: 8, m: 3, gnm: 2.0, hnm: 11.4, dgnm: 0.5, dhnm: -0.4 },
  { n: 8, m: 4, gnm: -21.7, hnm: -9.7, dgnm: -0.1, dhnm: 0.4 },
  { n: 8, m: 5, gnm: 16.9, hnm: 12.7, dgnm: 0.3, dhnm: -0.5 },
  { n: 8, m: 6, gnm: 15.0, hnm: 0.7, dgnm: 0.2, dhnm: -0.6 },
  { n: 8, m: 7, gnm: -16.8, hnm: -5.2, dgnm: -0.0, dhnm: 0.3 },
  { n: 8, m: 8, gnm: 0.9, hnm: 3.9, dgnm: 0.2, dhnm: 0.2 },
  { n: 9, m: 0, gnm: 4.6, hnm: 0.0, dgnm: -0.0, dhnm: 0.0 },
  { n: 9, m: 1, gnm: 7.8, hnm: -24.8, dgnm: -0.1, dhnm: -0.3 },
  { n: 9, m: 2, gnm: 3.0, hnm: 12.2, dgnm: 0.1, dhnm: 0.3 },
  { n: 9, m: 3, gnm: -0.2, hnm: 8.3, dgnm: 0.3, dhnm: -0.3 },
  { n: 9, m: 4, gnm: -2.5, hnm: -3.3, dgnm: -0.3, dhnm: 0.3 },
  { n: 9, m: 5, gnm: -13.1, hnm: -5.2, dgnm: 0.0, dhnm: 0.2 },
  { n: 9, m: 6, gnm: 2.4, hnm: 7.2, dgnm: 0.3, dhnm: -0.1 },
  { n: 9, m: 7, gnm: 8.6, hnm: -0.6, dgnm: -0.1, dhnm: -0.2 },
  { n: 9, m: 8, gnm: -8.7, hnm: 0.8, dgnm: 0.1, dhnm: 0.4 },
  { n: 9, m: 9, gnm: -12.9, hnm: 10.0, dgnm: -0.1, dhnm: 0.1 },
  { n: 10, m: 0, gnm: -1.3, hnm: 0.0, dgnm: 0.1, dhnm: 0.0 },
  { n: 10, m: 1, gnm: -6.4, hnm: 3.3, dgnm: 0.0, dhnm: 0.0 },
  { n: 10, m: 2, gnm: 0.2, hnm: 0.0, dgnm: 0.1, dhnm: -0.0 },
  { n: 10, m: 3, gnm: 2.0, hnm: 2.4, dgnm: 0.1, dhnm: -0.2 },
  { n: 10, m: 4, gnm: -1.0, hnm: 5.3, dgnm: -0.0, dhnm: 0.1 },
  { n: 10, m: 5, gnm: -0.6, hnm: -9.1, dgnm: -0.3, dhnm: -0.1 },
  { n: 10, m: 6, gnm: -0.9, hnm: 0.4, dgnm: 0.0, dhnm: 0.1 },
  { n: 10, m: 7, gnm: 1.5, hnm: -4.2, dgnm: -0.1, dhnm: 0.0 },
  { n: 10, m: 8, gnm: 0.9, hnm: -3.8, dgnm: -0.1, dhnm: -0.1 },
  { n: 10, m: 9, gnm: -2.7, hnm: 0.9, dgnm: -0.0, dhnm: 0.2 },
  { n: 10, m: 10, gnm: -3.9, hnm: -9.1, dgnm: -0.0, dhnm: -0.0 },
  { n: 11, m: 0, gnm: 2.9, hnm: 0.0, dgnm: 0.0, dhnm: 0.0 },
  { n: 11, m: 1, gnm: -1.5, hnm: 0.0, dgnm: -0.0, dhnm: -0.0 },
  { n: 11, m: 2, gnm: -2.5, hnm: 2.9, dgnm: 0.0, dhnm: 0.1 },
  { n: 11, m: 3, gnm: 2.4, hnm: -0.6, dgnm: 0.0, dhnm: -0.0 },
  { n: 11, m: 4, gnm: -0.6, hnm: 0.2, dgnm: 0.0, dhnm: 0.1 },
  { n: 11, m: 5, gnm: -0.1, hnm: 0.5, dgnm: -0.1, dhnm: -0.0 },
  { n: 11, m: 6, gnm: -0.6, hnm: -0.3, dgnm: 0.0, dhnm: -0.0 },
  { n: 11, m: 7, gnm: -0.1, hnm: -1.2, dgnm: -0.0, dhnm: 0.1 },
  { n: 11, m: 8, gnm: 1.1, hnm: -1.7, dgnm: -0.1, dhnm: -0.0 },
  { n: 11, m: 9, gnm: -1.0, hnm: -2.9, dgnm: -0.1, dhnm: 0.0 },
  { n: 11, m: 10, gnm: -0.2, hnm: -1.8, dgnm: -0.1, dhnm: 0.0 },
  { n: 11, m: 11, gnm: 2.6, hnm: -2.3, dgnm: -0.1, dhnm: 0.0 },
  { n: 12, m: 0, gnm: -2.0, hnm: 0.0, dgnm: 0.0, dhnm: 0.0 },
  { n: 12, m: 1, gnm: -0.2, hnm: -1.3, dgnm: 0.0, dhnm: -0.0 },
  { n: 12, m: 2, gnm: 0.3, hnm: 0.7, dgnm: -0.0, dhnm: 0.0 },
  { n: 12, m: 3, gnm: 1.2, hnm: 1.0, dgnm: -0.0, dhnm: -0.1 },
  { n: 12, m: 4, gnm: -1.3, hnm: -1.4, dgnm: -0.0, dhnm: 0.1 },
  { n: 12, m: 5, gnm: 0.6, hnm: -0.0, dgnm: -0.0, dhnm: -0.0 },
  { n: 12, m: 6, gnm: 0.6, hnm: 0.6, dgnm: 0.1, dhnm: -0.0 },
  { n: 12, m: 7, gnm: 0.5, hnm: -0.1, dgnm: -0.0, dhnm: -0.0 },
  { n: 12, m: 8, gnm: -0.1, hnm: 0.8, dgnm: 0.0, dhnm: 0.0 },
  { n: 12, m: 9, gnm: -0.4, hnm: 0.1, dgnm: 0.0, dhnm: -0.0 },
  { n: 12, m: 10, gnm: -0.2, hnm: -1.0, dgnm: -0.1, dhnm: -0.0 },
  { n: 12, m: 11, gnm: -1.3, hnm: 0.1, dgnm: -0.0, dhnm: 0.0 },
  { n: 12, m: 12, gnm: -0.7, hnm: 0.2, dgnm: -0.1, dhnm: -0.1 },
];
