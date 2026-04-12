/**
 * Airspeed calculations that complement the CAS-to-TAS, Mach, and speed-of-sound
 * functions in `@squawk/units` (`isa` namespace). This module provides the inverse
 * CAS-from-TAS computation not covered by `@squawk/units`.
 */

import { isa } from '@squawk/units';

/**
 * Converts true airspeed (TAS) to calibrated airspeed (CAS) using the full
 * compressible flow pitot-static equations (ICAO standard). This is the inverse
 * of `isa.trueAirspeedFromCalibratedKt()` from `@squawk/units`.
 *
 * The calculation derives the impact pressure (qc) from TAS at the actual altitude
 * conditions, then converts that impact pressure back to CAS using sea-level ISA
 * conditions.
 *
 * Valid for subsonic flight (Mach < 1.0) only. Assumes CAS equals equivalent
 * airspeed (EAS), which is accurate for most practical purposes. See
 * `isa.trueAirspeedFromCalibratedKt()` in `@squawk/units` for a full discussion of this
 * assumption.
 *
 * If oatCelsius is not provided, ISA standard temperature at the given altitude is used.
 *
 * @param trueAirspeedKt - True airspeed in knots.
 * @param pressureAltitudeFt - Pressure altitude in feet.
 * @param oatCelsius - Outside air temperature in degrees Celsius (optional, defaults to ISA).
 * @returns Calibrated airspeed (CAS) in knots.
 */
export function calibratedAirspeedFromTrueAirspeed(
  trueAirspeedKt: number,
  pressureAltitudeFt: number,
  oatCelsius?: number,
): number {
  const a0 = isa.ISA_SPEED_OF_SOUND_SEA_LEVEL_KT;
  const P0 = isa.ISA_SEA_LEVEL_PRESSURE_HPA;

  // Static pressure at the pressure altitude on the standard datum.
  const P = isa.pressureAtAltitudeHectopascals(pressureAltitudeFt);

  // Temperature at altitude (OAT if provided, else ISA standard).
  const tempC =
    oatCelsius !== undefined ? oatCelsius : isa.isaTemperatureCelsius(pressureAltitudeFt);
  const tempK = tempC + 273.15;

  // Speed of sound at altitude temperature.
  const a = a0 * Math.sqrt(tempK / isa.ISA_SEA_LEVEL_TEMP_K);

  // Impact pressure from TAS at actual altitude conditions (inverse of the TAS equation).
  const qc = P * (Math.pow((trueAirspeedKt / a) ** 2 / 5 + 1, 3.5) - 1);

  // CAS from impact pressure using sea-level ISA conditions.
  return a0 * Math.sqrt(5 * (Math.pow(qc / P0 + 1, 2 / 7) - 1));
}
