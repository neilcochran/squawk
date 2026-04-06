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
 * `isa.densityAltitudeFeet()` from `@squawk/units` directly.
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
  const pa = pressure.pressureAltitudeFeet(fieldElevationFt, altimeterSettingInHg);
  return isa.densityAltitudeFeet(pa, oatCelsius);
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
 * The correction uses the ratio of actual to ISA temperature at the computed
 * pressure altitude, which is the standard E6B flight computer method.
 *
 * @param indicatedAltitudeFt - Indicated altitude in feet (altimeter set to local QNH).
 * @param altimeterSettingInHg - Current altimeter setting (QNH) in inches of mercury.
 * @param oatCelsius - Outside air temperature in degrees Celsius.
 * @returns True altitude above MSL in feet.
 */
export function trueAltitude(
  indicatedAltitudeFt: number,
  altimeterSettingInHg: number,
  oatCelsius: number,
): number {
  const pa = pressure.pressureAltitudeFeet(indicatedAltitudeFt, altimeterSettingInHg);
  const isaTempK = isa.isaTemperatureCelsius(pa) + 273.15;
  const oatK = oatCelsius + 273.15;
  return pa * (oatK / isaTempK);
}
