/**
 * Magnetic field type definitions for WMM2025 computations.
 */

/**
 * Options for magnetic field computation.
 */
export interface MagneticFieldOptions {
  /**
   * Altitude in feet above mean sea level. Defaults to 0 (sea level).
   *
   * The WMM uses altitude above the WGS-84 ellipsoid (HAE). MSL altitude
   * is an approximation; the difference (geoid undulation) is typically
   * under 100 m and has negligible effect on declination at aviation altitudes.
   */
  readonly altitudeFt?: number | undefined;
  /**
   * Date for the computation. Defaults to the current date.
   *
   * The WMM2025 model is valid from 2025.0 to 2030.0. Outside this range
   * the model accuracy degrades but computations still produce results.
   */
  readonly date?: Date | undefined;
  /**
   * Decimal year for the computation (e.g. 2025.5). Takes priority over
   * {@link date} when both are provided.
   */
  readonly decimalYear?: number | undefined;
}

/**
 * Magnetic field components at a geographic position and time.
 *
 * All angles are in degrees. All field intensities are in nanotesla (nT).
 */
export interface MagneticFieldResult {
  /** Magnetic declination in degrees (positive east, negative west). */
  readonly declinationDeg: number;
  /** Magnetic inclination (dip) in degrees (positive down into the Earth). */
  readonly inclinationDeg: number;
  /** Horizontal intensity in nanotesla. */
  readonly horizontalIntensityNt: number;
  /** North component (X) in nanotesla. */
  readonly northIntensityNt: number;
  /** East component (Y) in nanotesla. */
  readonly eastIntensityNt: number;
  /** Down component (Z) in nanotesla. */
  readonly downIntensityNt: number;
  /** Total field intensity (F) in nanotesla. */
  readonly totalIntensityNt: number;
  /** Decimal year used for the computation. */
  readonly decimalYear: number;
}
