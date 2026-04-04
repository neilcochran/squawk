import { degreesToRadians } from './angle.js';

/**
 * Typed unit string literals for distance values to prevent unit confusion at the call site.
 */
export type DistanceUnit = 'nm' | 'sm' | 'km' | 'm' | 'ft';

/** Exact conversion: 1 nautical mile = 1.852 km. */
const NM_TO_KM = 1.852;

/** 1 nautical mile = 1.150779448 statute miles. */
const NM_TO_SM = 1.150779448;

/** 1 nautical mile = 1852 metres. */
const NM_TO_M = 1852;

/** 1 nautical mile = 6076.11549 feet. */
const NM_TO_FT = 6076.11549;

/** Exact conversion: 1 foot = 0.3048 metres. */
const FT_TO_M = 0.3048;

/** 1 statute mile = 1.609344 km. */
const SM_TO_KM = 1.609344;

/** 1 statute mile = 1609.344 metres. */
const SM_TO_M = 1609.344;

/** 1 statute mile = 5280 feet. */
const SM_TO_FT = 5280;

/**
 * Converts nautical miles to kilometres.
 * @param nauticalMiles - Distance in nautical miles.
 * @returns Distance in kilometres.
 */
export function nauticalMilesToKilometers(nauticalMiles: number): number {
  return nauticalMiles * NM_TO_KM;
}

/**
 * Converts kilometres to nautical miles.
 * @param kilometers - Distance in kilometres.
 * @returns Distance in nautical miles.
 */
export function kilometersToNauticalMiles(kilometers: number): number {
  return kilometers / NM_TO_KM;
}

/**
 * Converts nautical miles to statute miles.
 * @param nauticalMiles - Distance in nautical miles.
 * @returns Distance in statute miles.
 */
export function nauticalMilesToStatuteMiles(nauticalMiles: number): number {
  return nauticalMiles * NM_TO_SM;
}

/**
 * Converts statute miles to nautical miles.
 * @param statuteMiles - Distance in statute miles.
 * @returns Distance in nautical miles.
 */
export function statuteMilesToNauticalMiles(statuteMiles: number): number {
  return statuteMiles / NM_TO_SM;
}

/**
 * Converts nautical miles to metres.
 * @param nauticalMiles - Distance in nautical miles.
 * @returns Distance in metres.
 */
export function nauticalMilesToMeters(nauticalMiles: number): number {
  return nauticalMiles * NM_TO_M;
}

/**
 * Converts metres to nautical miles.
 * @param meters - Distance in metres.
 * @returns Distance in nautical miles.
 */
export function metersToNauticalMiles(meters: number): number {
  return meters / NM_TO_M;
}

/**
 * Converts nautical miles to feet.
 * @param nauticalMiles - Distance in nautical miles.
 * @returns Distance in feet.
 */
export function nauticalMilesToFeet(nauticalMiles: number): number {
  return nauticalMiles * NM_TO_FT;
}

/**
 * Converts feet to nautical miles.
 * @param feet - Distance in feet.
 * @returns Distance in nautical miles.
 */
export function feetToNauticalMiles(feet: number): number {
  return feet / NM_TO_FT;
}

/**
 * Converts kilometres to statute miles.
 * @param kilometers - Distance in kilometres.
 * @returns Distance in statute miles.
 */
export function kilometersToStatuteMiles(kilometers: number): number {
  return kilometers / SM_TO_KM;
}

/**
 * Converts statute miles to kilometres.
 * @param statuteMiles - Distance in statute miles.
 * @returns Distance in kilometres.
 */
export function statuteMilesToKilometers(statuteMiles: number): number {
  return statuteMiles * SM_TO_KM;
}

/**
 * Converts kilometres to metres.
 * @param kilometers - Distance in kilometres.
 * @returns Distance in metres.
 */
export function kilometersToMeters(kilometers: number): number {
  return kilometers * 1000;
}

/**
 * Converts metres to kilometres.
 * @param meters - Distance in metres.
 * @returns Distance in kilometres.
 */
export function metersToKilometers(meters: number): number {
  return meters / 1000;
}

/**
 * Converts kilometres to feet.
 * @param kilometers - Distance in kilometres.
 * @returns Distance in feet.
 */
export function kilometersToFeet(kilometers: number): number {
  return (kilometers * 1000) / FT_TO_M;
}

/**
 * Converts feet to kilometres.
 * @param feet - Distance in feet.
 * @returns Distance in kilometres.
 */
export function feetToKilometers(feet: number): number {
  return (feet * FT_TO_M) / 1000;
}

/**
 * Converts statute miles to metres.
 * @param statuteMiles - Distance in statute miles.
 * @returns Distance in metres.
 */
export function statuteMilesToMeters(statuteMiles: number): number {
  return statuteMiles * SM_TO_M;
}

/**
 * Converts metres to statute miles.
 * @param meters - Distance in metres.
 * @returns Distance in statute miles.
 */
export function metersToStatuteMiles(meters: number): number {
  return meters / SM_TO_M;
}

/**
 * Converts statute miles to feet.
 * @param statuteMiles - Distance in statute miles.
 * @returns Distance in feet.
 */
export function statuteMilesToFeet(statuteMiles: number): number {
  return statuteMiles * SM_TO_FT;
}

/**
 * Converts feet to statute miles.
 * @param feet - Distance in feet.
 * @returns Distance in statute miles.
 */
export function feetToStatuteMiles(feet: number): number {
  return feet / SM_TO_FT;
}

/**
 * Converts feet to metres.
 * @param feet - Distance in feet.
 * @returns Distance in metres.
 */
export function feetToMeters(feet: number): number {
  return feet * FT_TO_M;
}

/**
 * Converts metres to feet.
 * @param meters - Distance in metres.
 * @returns Distance in feet.
 */
export function metersToFeet(meters: number): number {
  return meters / FT_TO_M;
}

/** Mean radius of the Earth in nautical miles. */
const EARTH_RADIUS_NM = 3440.065;

/**
 * Computes the great-circle distance in nautical miles between two
 * geographic positions using the Haversine formula.
 *
 * @param lat1 - Latitude of the first point in decimal degrees.
 * @param lon1 - Longitude of the first point in decimal degrees.
 * @param lat2 - Latitude of the second point in decimal degrees.
 * @param lon2 - Longitude of the second point in decimal degrees.
 * @returns Distance in nautical miles.
 */
export function greatCircleDistanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_NM * c;
}
