/**
 * @squawk/units - Aviation-aware unit conversion and formatting utilities.
 *
 * All exports are grouped by domain namespace. Import the namespace and call functions
 * from it to keep the call site self-documenting:
 *
 * @example
 * ```ts
 * import { speed, isa, format } from '@squawk/units';
 *
 * const kmh = speed.knotsToKilometersPerHour(250);
 * const da = isa.densityAltitudeFt(5000, 30);
 * const label = format.formatAltitude(3500);
 * ```
 */

export * as speed from './speed.js';
export * as distance from './distance.js';
export * as altitude from './altitude.js';
export * as pressure from './pressure.js';
export * as temperature from './temperature.js';
export * as fuel from './fuel.js';
export * as angle from './angle.js';
export * as isa from './isa.js';
export * as format from './format.js';
