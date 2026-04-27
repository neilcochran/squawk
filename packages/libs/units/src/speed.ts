/**
 * Typed unit string literals for speed values to prevent unit confusion at the call site.
 */
export type SpeedUnit = 'kt' | 'km/h' | 'mph' | 'm/s';

/** Exact conversion: 1 knot = 1.852 km/h. */
const KTS_TO_KMH = 1.852;

/** 1 knot = 1.150779448 statute miles per hour. */
const KTS_TO_MPH = 1.150779448;

/** 1 knot = 0.514444 m/s. */
const KTS_TO_MS = 0.514444;

/** 1 mph = 1.609344 km/h. */
const MPH_TO_KMH = 1.609344;

/** 1 mph = 0.44704 m/s. */
const MPH_TO_MS = 0.44704;

/** 1 km/h = 0.277778 m/s. */
const KMH_TO_MS = 1 / 3.6;

/**
 * Converts knots to kilometres per hour.
 * @param knots - Speed in knots.
 * @returns Speed in km/h.
 */
export function knotsToKilometersPerHour(knots: number): number {
  return knots * KTS_TO_KMH;
}

/**
 * Converts kilometres per hour to knots.
 * @param kilometersPerHour - Speed in km/h.
 * @returns Speed in knots.
 */
export function kilometersPerHourToKnots(kilometersPerHour: number): number {
  return kilometersPerHour / KTS_TO_KMH;
}

/**
 * Converts knots to statute miles per hour.
 * @param knots - Speed in knots.
 * @returns Speed in mph.
 */
export function knotsToMilesPerHour(knots: number): number {
  return knots * KTS_TO_MPH;
}

/**
 * Converts statute miles per hour to knots.
 * @param milesPerHour - Speed in mph.
 * @returns Speed in knots.
 */
export function milesPerHourToKnots(milesPerHour: number): number {
  return milesPerHour / KTS_TO_MPH;
}

/**
 * Converts knots to metres per second.
 * @param knots - Speed in knots.
 * @returns Speed in m/s.
 */
export function knotsToMetersPerSecond(knots: number): number {
  return knots * KTS_TO_MS;
}

/**
 * Converts metres per second to knots.
 * @param metersPerSecond - Speed in m/s.
 * @returns Speed in knots.
 */
export function metersPerSecondToKnots(metersPerSecond: number): number {
  return metersPerSecond / KTS_TO_MS;
}

/**
 * Converts kilometres per hour to statute miles per hour.
 * @param kilometersPerHour - Speed in km/h.
 * @returns Speed in mph.
 */
export function kilometersPerHourToMilesPerHour(kilometersPerHour: number): number {
  return kilometersPerHour / MPH_TO_KMH;
}

/**
 * Converts statute miles per hour to kilometres per hour.
 * @param milesPerHour - Speed in mph.
 * @returns Speed in km/h.
 */
export function milesPerHourToKilometersPerHour(milesPerHour: number): number {
  return milesPerHour * MPH_TO_KMH;
}

/**
 * Converts kilometres per hour to metres per second.
 * @param kilometersPerHour - Speed in km/h.
 * @returns Speed in m/s.
 */
export function kilometersPerHourToMetersPerSecond(kilometersPerHour: number): number {
  return kilometersPerHour * KMH_TO_MS;
}

/**
 * Converts metres per second to kilometres per hour.
 * @param metersPerSecond - Speed in m/s.
 * @returns Speed in km/h.
 */
export function metersPerSecondToKilometersPerHour(metersPerSecond: number): number {
  return metersPerSecond / KMH_TO_MS;
}

/**
 * Converts statute miles per hour to metres per second.
 * @param milesPerHour - Speed in mph.
 * @returns Speed in m/s.
 */
export function milesPerHourToMetersPerSecond(milesPerHour: number): number {
  return milesPerHour * MPH_TO_MS;
}

/**
 * Converts metres per second to statute miles per hour.
 * @param metersPerSecond - Speed in m/s.
 * @returns Speed in mph.
 */
export function metersPerSecondToMilesPerHour(metersPerSecond: number): number {
  return metersPerSecond / MPH_TO_MS;
}
