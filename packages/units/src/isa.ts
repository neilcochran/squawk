/**
 * ICAO International Standard Atmosphere (ISA) model covering the troposphere
 * (0-36,089 ft / 0-11,000 m) and the lower stratosphere (36,089-65,617 ft / 11,000-20,000 m).
 *
 * Reference: ICAO Doc 7488/3, "Manual of the ICAO Standard Atmosphere", 3rd edition.
 */

/** ISA sea-level standard temperature in Kelvin (15 degrees C). */
export const ISA_SEA_LEVEL_TEMP_K = 288.15;

/** ISA sea-level standard temperature in Celsius. */
export const ISA_SEA_LEVEL_TEMP_C = 15;

/** ISA sea-level standard pressure in hPa. */
export const ISA_SEA_LEVEL_PRESSURE_HPA = 1013.25;

/** ISA sea-level standard pressure in inHg. */
export const ISA_SEA_LEVEL_PRESSURE_INHG = 29.92126;

/** ISA sea-level standard air density in kg/m^3. */
export const ISA_SEA_LEVEL_DENSITY_KGM3 = 1.225;

/** ISA temperature lapse rate in the troposphere: 0.0065 K/m. */
export const ISA_LAPSE_RATE_K_PER_M = 0.0065;

/** Tropopause altitude in feet (above which temperature is constant in the lower stratosphere). */
export const ISA_TROPOPAUSE_ALT_FT = 36089.24;

/** Tropopause altitude in metres. */
export const ISA_TROPOPAUSE_ALT_M = 11000;

/** Constant temperature in the lower stratosphere: -56.5 degrees C = 216.65 K. */
export const ISA_STRATOSPHERE_TEMP_K = 216.65;

/** ISA temperature lapse rate in degrees C per 1000 ft (troposphere). */
export const ISA_LAPSE_RATE_C_PER_1000FT = 1.98122;

/** Standard acceleration of gravity in m/s^2. */
const G = 9.80665;

/** Specific gas constant for dry air in J/(kg*K). */
const R = 287.05287;

/** Exact conversion: 1 foot = 0.3048 metres. */
const FT_TO_M = 0.3048;

/**
 * Exponent used in the ISA troposphere pressure-altitude formula: g / (R * L).
 * Approximately 5.25588.
 */
const PRESSURE_EXPONENT = G / (R * ISA_LAPSE_RATE_K_PER_M);

/**
 * Speed of sound at ISA sea-level conditions in knots.
 * Derived from sqrt(gamma * R * T0) = 340.294 m/s = 661.479 kt.
 */
export const ISA_SPEED_OF_SOUND_SEA_LEVEL_KNOTS = 661.4788;

/**
 * Returns the ISA standard temperature in Celsius at a given pressure altitude.
 * Applies the troposphere lapse rate below the tropopause (36,089 ft) and the
 * constant stratosphere temperature above it (up to 65,617 ft / 20,000 m).
 *
 * Altitudes above 65,617 ft are outside the modelled range. The ISA defines a
 * warming layer above 20,000 m, but this is not implemented here as it is beyond
 * the operating ceiling of all practical manned and commercial aviation.
 *
 * @param pressureAltitudeFt - Pressure altitude in feet.
 * @returns ISA standard temperature in degrees Celsius.
 */
export function isaTemperatureCelsius(pressureAltitudeFt: number): number {
  if (pressureAltitudeFt <= ISA_TROPOPAUSE_ALT_FT) {
    return ISA_SEA_LEVEL_TEMP_C - ISA_LAPSE_RATE_C_PER_1000FT * (pressureAltitudeFt / 1000);
  }
  return -56.5;
}

/**
 * Returns the ISA standard static pressure in hectopascals at a given altitude.
 * Uses the ISA sea-level pressure as the reference unless overridden.
 *
 * The optional seaLevelPressureHpa override is meaningful for troposphere altitudes
 * only (scaling the pressure profile by the QNH ratio). In the stratosphere branch,
 * the temperature is always the ISA constant (216.65 K) regardless of sea-level
 * pressure, so the override affects only the tropopause boundary pressure used as
 * the starting point for the exponential stratosphere calculation.
 *
 * @param altitudeFt - Altitude in feet.
 * @param seaLevelPressureHpa - Sea-level pressure in hPa (defaults to ISA standard 1013.25 hPa).
 * @returns Static pressure in hPa at the given altitude.
 */
export function pressureAtAltitudeHectopascals(
  altitudeFt: number,
  seaLevelPressureHpa: number = ISA_SEA_LEVEL_PRESSURE_HPA,
): number {
  const altM = altitudeFt * FT_TO_M;

  if (altitudeFt <= ISA_TROPOPAUSE_ALT_FT) {
    // Troposphere: pressure decreases with the ISA lapse rate.
    return (
      seaLevelPressureHpa *
      Math.pow(1 - (ISA_LAPSE_RATE_K_PER_M * altM) / ISA_SEA_LEVEL_TEMP_K, PRESSURE_EXPONENT)
    );
  }

  // Lower stratosphere: isothermal layer, exponential pressure decrease.
  const tropopausePressure = pressureAtAltitudeHectopascals(
    ISA_TROPOPAUSE_ALT_FT,
    seaLevelPressureHpa,
  );
  const deltaAltM = (altitudeFt - ISA_TROPOPAUSE_ALT_FT) * FT_TO_M;
  return tropopausePressure * Math.exp((-G * deltaAltM) / (R * ISA_STRATOSPHERE_TEMP_K));
}

/**
 * Returns the density altitude in feet.
 * Density altitude is the pressure altitude corrected for non-standard temperature - the
 * altitude at which the aircraft performs as if it were in the standard atmosphere.
 * High density altitude degrades engine power, propeller/rotor efficiency, and lift.
 *
 * Assumes the resulting density altitude falls within the troposphere (below 36,089 ft).
 * Density altitudes above the tropopause are uncommon in practice but are not validated.
 *
 * @param pressureAltFt - Pressure altitude in feet.
 * @param oatCelsius - Outside air temperature (OAT) in degrees Celsius.
 * @returns Density altitude in feet.
 */
export function densityAltitudeFeet(pressureAltFt: number, oatCelsius: number): number {
  const T0 = ISA_SEA_LEVEL_TEMP_K;
  const T_isa = isaTemperatureCelsius(pressureAltFt) + 273.15;
  const T_actual = oatCelsius + 273.15;

  // Actual density ratio relative to ISA sea-level: σ = (P/P0) * (T0/T_actual).
  // At the pressure altitude, P/P0 = (T_isa/T0)^exponent from the ISA troposphere formula.
  const sigmaActual = Math.pow(T_isa / T0, PRESSURE_EXPONENT) * (T0 / T_actual);

  // In the standard atmosphere troposphere: σ(h) = (T(h)/T0)^(exponent-1).
  // Invert to find the standard temperature at the density altitude.
  const T_std_at_DA = T0 * Math.pow(sigmaActual, 1 / (PRESSURE_EXPONENT - 1));

  return (T0 - T_std_at_DA) / ISA_LAPSE_RATE_K_PER_M / FT_TO_M;
}

/**
 * Returns the speed of sound in knots at the given temperature.
 * Speed of sound varies with temperature as: a = a0 * sqrt(T / T0).
 *
 * @param temperatureCelsius - Air temperature in degrees Celsius.
 * @returns Speed of sound in knots.
 */
export function speedOfSoundKnots(temperatureCelsius: number): number {
  const tempK = temperatureCelsius + 273.15;
  return ISA_SPEED_OF_SOUND_SEA_LEVEL_KNOTS * Math.sqrt(tempK / ISA_SEA_LEVEL_TEMP_K);
}

/**
 * Converts calibrated airspeed (CAS) to true airspeed (TAS) using the full
 * compressible flow pitot-static equations (ICAO standard). CAS equals TAS only
 * at ISA sea level; TAS increases relative to CAS as altitude and/or temperature
 * deviation increases.
 *
 * Valid for subsonic flight (Mach < 1.0) only. At transonic or supersonic speeds
 * a normal shock forms ahead of the pitot probe and a different equation set applies.
 * Typical commercial and general aviation operations are well within the subsonic range.
 *
 * Assumes CAS equals equivalent airspeed (EAS). In practice, instrument and position
 * errors cause a small divergence between CAS and EAS that is aircraft-specific and
 * requires calibration data not available to a general-purpose library.
 *
 * If oatCelsius is not provided, ISA standard temperature at the given altitude is used.
 *
 * @param casKnots - Calibrated airspeed in knots.
 * @param pressureAltFt - Pressure altitude in feet.
 * @param oatCelsius - Outside air temperature in degrees Celsius (optional, defaults to ISA).
 * @returns True airspeed (TAS) in knots.
 */
export function tasFromCasKnots(
  casKnots: number,
  pressureAltFt: number,
  oatCelsius?: number,
): number {
  const a0 = ISA_SPEED_OF_SOUND_SEA_LEVEL_KNOTS;
  const P0 = ISA_SEA_LEVEL_PRESSURE_HPA;

  // Static pressure at the pressure altitude on the standard datum.
  const P = pressureAtAltitudeHectopascals(pressureAltFt);

  // Temperature at altitude (OAT if provided, else ISA standard).
  const tempC = oatCelsius !== undefined ? oatCelsius : isaTemperatureCelsius(pressureAltFt);
  const tempK = tempC + 273.15;

  // Speed of sound at altitude temperature.
  const a = a0 * Math.sqrt(tempK / ISA_SEA_LEVEL_TEMP_K);

  // Impact pressure from CAS using sea-level ISA conditions (compressible flow).
  const qc = P0 * (Math.pow(1 + (casKnots / a0) ** 2 / 5, 3.5) - 1);

  // TAS from impact pressure and actual altitude conditions.
  return a * Math.sqrt(5 * (Math.pow(qc / P + 1, 2 / 7) - 1));
}

/**
 * Computes the Mach number from true airspeed and outside air temperature.
 * Mach number is the ratio of TAS to the local speed of sound, which varies
 * with temperature (and thus altitude in ISA conditions).
 *
 * @param tasKnots - True airspeed in knots.
 * @param oatCelsius - Outside air temperature in degrees Celsius.
 * @returns Mach number (dimensionless).
 */
export function machFromTasKnots(tasKnots: number, oatCelsius: number): number {
  return tasKnots / speedOfSoundKnots(oatCelsius);
}

/**
 * Computes the true airspeed from a Mach number and outside air temperature.
 *
 * @param mach - Mach number (dimensionless).
 * @param oatCelsius - Outside air temperature in degrees Celsius.
 * @returns True airspeed (TAS) in knots.
 */
export function tasFromMachKnots(mach: number, oatCelsius: number): number {
  return mach * speedOfSoundKnots(oatCelsius);
}
