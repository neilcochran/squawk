/**
 * Atmosphere and altitude calculations that combine multiple inputs into
 * higher-level results. For the underlying ISA model constants and base
 * computations (ISA temperature, pressure at altitude, density altitude
 * from pressure altitude + OAT, TAS from CAS, etc.), see `@squawk/units`
 * (`isa` and `pressure` namespaces).
 */

import { isa, pressure } from '@squawk/units';

/**
 * Computes density altitude from field-level observations. This is a convenience
 * function that first derives pressure altitude from the field elevation and
 * altimeter setting, then applies the temperature correction via the ISA model.
 *
 * Density altitude represents the altitude in the standard atmosphere at which
 * the air density equals the actual density at the observation point. High density
 * altitude degrades engine power, propeller/rotor efficiency, and aerodynamic lift.
 *
 * For the two-input form (pressure altitude + OAT already known), use
 * `isa.densityAltitudeFt()` from `@squawk/units` directly.
 *
 * @param fieldElevationFt - Field elevation above MSL in feet.
 * @param altimeterSettingInHg - Current altimeter setting (QNH) in inches of mercury.
 * @param oatCelsius - Outside air temperature at the field in degrees Celsius.
 * @returns Density altitude in feet.
 */
export function densityAltitude(
  fieldElevationFt: number,
  altimeterSettingInHg: number,
  oatCelsius: number,
): number {
  const pa = pressure.pressureAltitudeFt(fieldElevationFt, altimeterSettingInHg);
  return isa.densityAltitudeFt(pa, oatCelsius);
}

/**
 * Computes true altitude from indicated altitude, altimeter setting, and outside
 * air temperature. True altitude is the actual height above mean sea level,
 * corrected for non-standard temperature.
 *
 * A barometric altimeter assumes the ISA temperature profile when converting
 * pressure to altitude. When the actual temperature deviates from ISA, the
 * pressure levels are displaced vertically and the indicated altitude diverges
 * from the true altitude. This function corrects for that displacement.
 *
 * When `stationElevationFt` is provided, the temperature correction is applied
 * only to the altitude above the station. The air column below the station does
 * not contribute to altimeter error, so restricting the correction to the
 * measured column produces a more accurate result.
 *
 * When `stationElevationFt` is omitted, the correction ratio is applied to the
 * full indicated altitude, which matches the standard E6B flight computer method.
 *
 * @param indicatedAltitudeFt - Indicated altitude in feet (altimeter set to local QNH).
 * @param altimeterSettingInHg - Current altimeter setting (QNH) in inches of mercury.
 * @param oatCelsius - Outside air temperature in degrees Celsius.
 * @param stationElevationFt - Elevation of the station providing the altimeter setting, in feet MSL. When provided, the temperature correction is applied only to the altitude above this elevation.
 * @returns True altitude above MSL in feet.
 */
export function trueAltitude(
  indicatedAltitudeFt: number,
  altimeterSettingInHg: number,
  oatCelsius: number,
  stationElevationFt?: number,
): number {
  const pa = pressure.pressureAltitudeFt(indicatedAltitudeFt, altimeterSettingInHg);
  const isaTempK = isa.isaTemperatureCelsius(pa) + 273.15;
  const oatK = oatCelsius + 273.15;
  const tempRatio = oatK / isaTempK;

  if (stationElevationFt !== undefined) {
    const altAboveStation = indicatedAltitudeFt - stationElevationFt;
    return stationElevationFt + altAboveStation * tempRatio;
  }

  return indicatedAltitudeFt * tempRatio;
}
