/**
 * Typed unit string literals for pressure values to prevent unit confusion at the call site.
 */
export type PressureUnit = 'inHg' | 'hPa' | 'mmHg';

/**
 * Conversion factor: 1 inHg = 33.8639 hPa.
 * Derived from standard atmosphere: 1 atm = 29.92126 inHg = 1013.25 hPa.
 */
const INHG_TO_HPA = 33.8639;

/**
 * Conversion factor: 1 inHg = 25.4 mmHg.
 * Derived from: 1 atm = 29.92126 inHg = 760 mmHg, so 760/29.92126 = 25.4.
 */
const INHG_TO_MMHG = 25.4;

/**
 * Conversion factor: 1 hPa to mmHg.
 * Derived from: 760 mmHg / 1013.25 hPa.
 */
const HPA_TO_MMHG = 760 / 1013.25;

/**
 * ISA sea-level standard pressure in hPa.
 * Used for QNH/QFE and pressure altitude calculations.
 */
const ISA_P0_HPA = 1013.25;

/**
 * ISA sea-level standard pressure in inHg.
 * Used for pressure altitude calculations.
 */
const ISA_P0_INHG = 29.92126;

/**
 * ISA sea-level standard temperature in Kelvin (15 degrees C).
 * Used for QNH/QFE conversion.
 */
const ISA_T0_K = 288.15;

/** ISA temperature lapse rate in K/m (troposphere). */
const ISA_L = 0.0065;

/** Standard acceleration of gravity in m/s^2. */
const ISA_G = 9.80665;

/** Specific gas constant for dry air in J/(kg*K). */
const ISA_R = 287.05287;

/** Exponent used in the ISA pressure-altitude formula: g / (R * L). */
const ISA_PRESSURE_EXPONENT = ISA_G / (ISA_R * ISA_L);

/** Exact conversion: 1 foot = 0.3048 metres. */
const FT_TO_M = 0.3048;

/**
 * Converts inches of mercury to hectopascals.
 * @param inchesOfMercury - Pressure in inHg.
 * @returns Pressure in hPa.
 */
export function inchesOfMercuryToHectopascals(inchesOfMercury: number): number {
  return inchesOfMercury * INHG_TO_HPA;
}

/**
 * Converts hectopascals to inches of mercury.
 * @param hectopascals - Pressure in hPa.
 * @returns Pressure in inHg.
 */
export function hectopascalsToInchesOfMercury(hectopascals: number): number {
  return hectopascals / INHG_TO_HPA;
}

/**
 * Converts hectopascals to millimetres of mercury.
 * @param hectopascals - Pressure in hPa.
 * @returns Pressure in mmHg.
 */
export function hectopascalsToMillimetersOfMercury(hectopascals: number): number {
  return hectopascals * HPA_TO_MMHG;
}

/**
 * Converts millimetres of mercury to hectopascals.
 * @param millimetersOfMercury - Pressure in mmHg.
 * @returns Pressure in hPa.
 */
export function millimetersOfMercuryToHectopascals(millimetersOfMercury: number): number {
  return millimetersOfMercury / HPA_TO_MMHG;
}

/**
 * Converts inches of mercury to millimetres of mercury.
 * @param inchesOfMercury - Pressure in inHg.
 * @returns Pressure in mmHg.
 */
export function inchesOfMercuryToMillimetersOfMercury(inchesOfMercury: number): number {
  return inchesOfMercury * INHG_TO_MMHG;
}

/**
 * Converts millimetres of mercury to inches of mercury.
 * @param millimetersOfMercury - Pressure in mmHg.
 * @returns Pressure in inHg.
 */
export function millimetersOfMercuryToInchesOfMercury(millimetersOfMercury: number): number {
  return millimetersOfMercury / INHG_TO_MMHG;
}

/**
 * Converts QNH (sea-level altimeter setting) to QFE (field elevation pressure)
 * for a given airfield elevation.
 *
 * Uses the ISA standard temperature profile to compute the pressure gradient between
 * sea level and the airfield. On days with significant temperature deviation from ISA,
 * the actual gradient differs, introducing a small error. This is the industry-standard
 * approach and matches how real barometric altimeters perform the conversion.
 *
 * @param qnhHpa - QNH altimeter setting in hPa.
 * @param airfieldElevationFt - Airfield elevation above MSL in feet.
 * @returns QFE (pressure at the airfield surface) in hPa.
 */
export function qnhToQfe(qnhHpa: number, airfieldElevationFt: number): number {
  const elevationM = airfieldElevationFt * FT_TO_M;
  return qnhHpa * Math.pow(1 - (ISA_L * elevationM) / ISA_T0_K, ISA_PRESSURE_EXPONENT);
}

/**
 * Converts QFE (field elevation pressure) to QNH (sea-level altimeter setting)
 * for a given airfield elevation.
 *
 * Uses the ISA standard temperature profile to compute the pressure gradient between
 * the airfield and sea level. See qnhToQfe for a full discussion of the ISA temperature
 * assumption and its practical implications.
 *
 * @param qfeHpa - QFE surface pressure in hPa.
 * @param airfieldElevationFt - Airfield elevation above MSL in feet.
 * @returns QNH altimeter setting in hPa.
 */
export function qfeToQnh(qfeHpa: number, airfieldElevationFt: number): number {
  const elevationM = airfieldElevationFt * FT_TO_M;
  return qfeHpa / Math.pow(1 - (ISA_L * elevationM) / ISA_T0_K, ISA_PRESSURE_EXPONENT);
}

/**
 * Computes pressure altitude from an indicated altitude and QNH altimeter setting.
 * Pressure altitude is the altitude referenced to the ISA standard datum (29.92126 inHg /
 * 1013.25 hPa) rather than local QNH. It is used for flight level assignment and
 * performance calculations.
 *
 * The calculation derives the actual static pressure at the indicated altitude (using the
 * given QNH as the sea-level reference), then inverts the ISA pressure-altitude formula
 * to find the equivalent altitude on the standard datum. Uses the troposphere formula
 * throughout, which is accurate for all practical QNH use. QNH is only set below
 * FL180 in the US (and equivalent transition altitudes internationally); above that,
 * standard pressure (29.92 inHg) is used and indicated altitude equals pressure altitude
 * by definition.
 *
 * @param indicatedAltitudeFt - Indicated altitude in feet (read from altimeter set to QNH).
 * @param qnhInHg - QNH altimeter setting in inches of mercury.
 * @returns Pressure altitude in feet.
 */
export function pressureAltitudeFt(indicatedAltitudeFt: number, qnhInHg: number): number {
  const qnhHpa = qnhInHg * INHG_TO_HPA;
  const indicatedAltM = indicatedAltitudeFt * FT_TO_M;

  // Actual static pressure at the indicated altitude, using QNH as sea-level reference.
  const actualPressureHpa =
    qnhHpa * Math.pow(1 - (ISA_L * indicatedAltM) / ISA_T0_K, ISA_PRESSURE_EXPONENT);

  // Invert the ISA pressure formula to find the standard-datum altitude for this pressure.
  const pressureAltM =
    (ISA_T0_K / ISA_L) * (1 - Math.pow(actualPressureHpa / ISA_P0_HPA, 1 / ISA_PRESSURE_EXPONENT));

  return pressureAltM / FT_TO_M;
}

/**
 * ISA standard sea-level pressure in hPa (1013.25).
 * Exported for use in formatting and display.
 */
export { ISA_P0_HPA, ISA_P0_INHG };
