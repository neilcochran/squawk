import { altitude, distance, speed } from '@squawk/units';

/**
 * Which unit system the table, detail view, and stats render in. Aviation
 * units are the ADS-B wire units (feet, knots, nautical miles, feet per
 * minute); metric swaps in metres, km/h, kilometres, and metres per second.
 */
export type UnitSystem = 'aviation' | 'metric';

/** The unit system adsbtop starts in unless `--units` says otherwise. */
export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'aviation';

/**
 * Whether `value` names a unit system, for `--units`.
 *
 * @param value - The raw flag value.
 * @returns True for `aviation` or `metric`.
 */
export function isUnitSystem(value: string): value is UnitSystem {
  return value === 'aviation' || value === 'metric';
}

/**
 * The other unit system, for the `[U]` toggle.
 *
 * @param units - The current system.
 * @returns `metric` for `aviation` and vice versa.
 */
export function toggleUnitSystem(units: UnitSystem): UnitSystem {
  return units === 'aviation' ? 'metric' : 'aviation';
}

/**
 * Formats an altitude for display.
 *
 * @param valueFt - The altitude in feet, or undefined if unknown.
 * @param units - The unit system to render in.
 * @returns E.g. `"35000ft"` or `"10668m"`, or `"-"` if undefined.
 */
export function formatAltitudeValue(valueFt: number | undefined, units: UnitSystem): string {
  if (valueFt === undefined) {
    return '-';
  }
  return units === 'metric'
    ? `${Math.round(altitude.feetToMeters(valueFt))}m`
    : `${Math.round(valueFt)}ft`;
}

/**
 * Formats a speed for display.
 *
 * @param valueKt - The speed in knots, or undefined if unknown.
 * @param units - The unit system to render in.
 * @returns E.g. `"515kt"` or `"954km/h"`, or `"-"` if undefined.
 */
export function formatSpeedValue(valueKt: number | undefined, units: UnitSystem): string {
  if (valueKt === undefined) {
    return '-';
  }
  return units === 'metric'
    ? `${Math.round(speed.knotsToKilometersPerHour(valueKt))}km/h`
    : `${Math.round(valueKt)}kt`;
}

/**
 * Formats a vertical rate for display, with an explicit `+` on climbs so
 * climb/descend is visible without color.
 *
 * @param valueFtPerMin - The rate in feet per minute, or undefined if unknown.
 * @param units - The unit system to render in.
 * @returns E.g. `"+1200fpm"` or `"+6.1m/s"`, or `"-"` if undefined.
 */
export function formatVerticalRateValue(
  valueFtPerMin: number | undefined,
  units: UnitSystem,
): string {
  if (valueFtPerMin === undefined) {
    return '-';
  }
  if (units === 'metric') {
    const metersPerSec = Math.round((altitude.feetToMeters(valueFtPerMin) / 60) * 10) / 10;
    const sign = metersPerSec > 0 ? '+' : '';
    return `${sign}${metersPerSec.toFixed(1)}m/s`;
  }
  const rounded = Math.round(valueFtPerMin);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}fpm`;
}

/**
 * Converts a distance in nautical miles to the display unit's magnitude,
 * for callers that apply their own rounding (the CPA formatter keeps one
 * decimal under ten).
 *
 * @param valueNm - The distance in nautical miles.
 * @param units - The unit system to render in.
 * @returns The distance in nautical miles or kilometres.
 */
export function distanceInUnits(valueNm: number, units: UnitSystem): number {
  return units === 'metric' ? distance.nauticalMilesToKilometers(valueNm) : valueNm;
}

/**
 * The distance unit's suffix.
 *
 * @param units - The unit system to render in.
 * @returns `"nm"` or `"km"`.
 */
export function distanceUnitSuffix(units: UnitSystem): string {
  return units === 'metric' ? 'km' : 'nm';
}

/**
 * Formats a distance for display, rounded to whole units.
 *
 * @param valueNm - The distance in nautical miles, or undefined if unknown.
 * @param units - The unit system to render in.
 * @returns E.g. `"212nm"` or `"393km"`, or `"-"` if undefined.
 */
export function formatDistanceValue(valueNm: number | undefined, units: UnitSystem): string {
  if (valueNm === undefined) {
    return '-';
  }
  return `${Math.round(distanceInUnits(valueNm, units))}${distanceUnitSuffix(units)}`;
}
