import { isaTemperatureCelsius } from './isa.js';
import type { DistanceUnit } from './distance.js';
import type { PressureUnit } from './pressure.js';
import type { TemperatureUnit } from './temperature.js';

/**
 * Speed unit string literals accepted by formatSpeed. Includes 'mach' in addition
 * to the standard speed units.
 */
export type FormatSpeedUnit = 'kt' | 'km/h' | 'mph' | 'm/s' | 'mach';

/**
 * Options accepted by all formatter functions.
 */
export interface FormatOptions {
  /** Number of decimal places to display. Overrides the default for the given unit. */
  precision?: number;
  /**
   * BCP 47 locale string for number formatting (e.g. 'en-US', 'de-DE').
   * Defaults to the runtime's default locale.
   */
  locale?: string;
}

/**
 * Options specific to formatTemperature.
 */
export interface FormatTemperatureOptions extends FormatOptions {
  /**
   * When true, appends the ISA deviation to the formatted string (e.g. "+5 ISA").
   * Requires altitudeFt to be provided.
   */
  showISADeviation?: boolean;
  /** Pressure altitude in feet, required when showISADeviation is true. */
  altitudeFt?: number;
}

/**
 * Altitude in feet above which the US convention displays altitude as a flight level.
 * At or above FL180 (18,000 ft MSL), altitudes are expressed as flight levels.
 */
const FLIGHT_LEVEL_THRESHOLD_FT = 18000;

/**
 * Returns true if the given altitude should be expressed as a flight level under
 * US conventions (at or above 18,000 ft MSL / FL180).
 *
 * @param altitudeFt - Altitude in feet MSL.
 * @returns True if the altitude is at or above the Class A airspace floor (FL180).
 */
export function isFlightLevel(altitudeFt: number): boolean {
  return altitudeFt >= FLIGHT_LEVEL_THRESHOLD_FT;
}

/**
 * Formats an altitude in feet as a flight level string (e.g. "FL350", "FL085").
 * The flight level number is the altitude in hundreds of feet, zero-padded to three digits.
 *
 * @param altitudeFt - Altitude in feet (should be a multiple of 100 for standard use).
 * @returns Flight level string such as "FL350" or "FL085".
 */
export function formatFlightLevel(altitudeFt: number): string {
  const fl = Math.round(altitudeFt / 100);
  return `FL${fl.toString().padStart(3, '0')}`;
}

/**
 * Formats an altitude in feet as a human-readable string with thousands separator.
 * If the altitude is at or above FL180, returns a flight level string instead.
 *
 * @param altitudeFt - Altitude in feet.
 * @param options - Optional formatting overrides.
 * @returns Formatted altitude string such as "3,500 ft" or "FL350".
 */
export function formatAltitude(altitudeFt: number, options?: FormatOptions): string {
  if (isFlightLevel(altitudeFt)) {
    return formatFlightLevel(altitudeFt);
  }
  const precision = options?.precision ?? 0;
  const formatted = new Intl.NumberFormat(options?.locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(altitudeFt);
  return `${formatted} ft`;
}

/**
 * Formats a speed value with its unit label.
 * For Mach numbers, the value is formatted as "M0.82".
 * For all other units the value and unit are separated by a space.
 *
 * Default precision:
 * - 'mach': 2 decimal places
 * - 'kt', 'mph': 0 decimal places
 * - 'km/h', 'm/s': 0 decimal places
 *
 * @param value - Speed value in the given unit.
 * @param unit - The speed unit to display.
 * @param options - Optional formatting overrides.
 * @returns Formatted speed string such as "250 kt" or "M0.82".
 */
export function formatSpeed(value: number, unit: FormatSpeedUnit, options?: FormatOptions): string {
  if (unit === 'mach') {
    const precision = options?.precision ?? 2;
    return `M${value.toFixed(precision)}`;
  }
  const defaultPrecision: Record<Exclude<FormatSpeedUnit, 'mach'>, number> = {
    kt: 0,
    'km/h': 0,
    mph: 0,
    'm/s': 1,
  };
  const precision = options?.precision ?? defaultPrecision[unit];
  const formatted = new Intl.NumberFormat(options?.locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
  return `${formatted} ${unit}`;
}

/**
 * Formats a pressure value (QNH/altimeter setting) with its unit label.
 *
 * Default precision:
 * - 'inHg': 2 decimal places
 * - 'hPa': 0 decimal places (integers are standard for hPa in aviation)
 * - 'mmHg': 0 decimal places
 *
 * @param value - Pressure value in the given unit.
 * @param unit - The pressure unit to display.
 * @param options - Optional formatting overrides.
 * @returns Formatted pressure string such as "29.92 inHg" or "1013 hPa".
 */
export function formatQNH(value: number, unit: PressureUnit, options?: FormatOptions): string {
  const defaultPrecision: Record<PressureUnit, number> = {
    inHg: 2,
    hPa: 0,
    mmHg: 0,
  };
  const precision = options?.precision ?? defaultPrecision[unit];
  const formatted = new Intl.NumberFormat(options?.locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
  return `${formatted} ${unit}`;
}

/**
 * Formats a distance value with its unit label.
 *
 * Default precision:
 * - 'nm': 1 decimal place
 * - 'sm': 1 decimal place
 * - 'km': 1 decimal place
 * - 'm': 0 decimal places
 * - 'ft': 0 decimal places
 *
 * @param value - Distance value in the given unit.
 * @param unit - The distance unit to display.
 * @param options - Optional formatting overrides.
 * @returns Formatted distance string such as "1.5 nm" or "500 m".
 */
export function formatDistance(value: number, unit: DistanceUnit, options?: FormatOptions): string {
  const defaultPrecision: Record<DistanceUnit, number> = {
    nm: 1,
    sm: 1,
    km: 1,
    m: 0,
    ft: 0,
  };
  const precision = options?.precision ?? defaultPrecision[unit];
  const formatted = new Intl.NumberFormat(options?.locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);
  return `${formatted} ${unit}`;
}

/**
 * Formats a temperature value with its unit symbol.
 * Optionally appends the ISA deviation when showISADeviation is true and
 * altitudeFt is provided.
 *
 * The ISA deviation is the difference between the given temperature and the
 * ISA standard temperature at the specified altitude, rounded to the nearest
 * whole degree. Displayed as "(+5 ISA)" or "(-3 ISA)".
 *
 * Default precision: 0 decimal places for all units (aviation weather uses integers).
 *
 * @param value - Temperature value in the given unit.
 * @param unit - The temperature unit to display ('C', 'F', or 'K').
 * @param options - Optional formatting and ISA deviation options.
 * @returns Formatted temperature string such as "15°C" or "15°C (+5 ISA)".
 */
export function formatTemperature(
  value: number,
  unit: TemperatureUnit,
  options?: FormatTemperatureOptions,
): string {
  const precision = options?.precision ?? 0;
  const formatted = new Intl.NumberFormat(options?.locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(value);

  const unitSymbol = unit === 'K' ? 'K' : `\u00B0${unit}`;
  let result = `${formatted}${unitSymbol}`;

  if (options?.showISADeviation && options.altitudeFt !== undefined && unit === 'C') {
    const isaTemp = isaTemperatureCelsius(options.altitudeFt);
    const deviation = Math.round(value - isaTemp);
    const sign = deviation >= 0 ? '+' : '';
    result += ` (${sign}${deviation} ISA)`;
  }

  return result;
}
