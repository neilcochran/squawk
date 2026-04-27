/**
 * Solar position calculations: sunrise, sunset, civil twilight, and
 * day/night determination.
 *
 * Uses the NOAA solar calculator algorithm based on Jean Meeus'
 * "Astronomical Algorithms". Accurate to within approximately one minute
 * for dates between 1901 and 2099.
 */

import type { SolarTimes } from './types/solar.js';

/** Standard zenith angle for sunrise/sunset: 90.833 degrees.
 * Accounts for atmospheric refraction (0.567 degrees) and the sun's
 * semi-diameter (0.266 degrees). */
const SUNRISE_SUNSET_ZENITH = 90.833;

/** Zenith angle for civil twilight: 96 degrees (sun 6 degrees below horizon). */
const CIVIL_TWILIGHT_ZENITH = 96;

/** Degrees to radians. */
const DEG_TO_RAD = Math.PI / 180;

/** Radians to degrees. */
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Computes the Julian Day Number for a given UTC date.
 *
 * @param year - Full year (e.g. 2026).
 * @param month - Month (1-12).
 * @param day - Day of month (1-31, may include fractional part for time of day).
 * @returns Julian Day Number.
 */
function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

/**
 * Computes the Julian Century from a Julian Day Number.
 *
 * @param jd - Julian Day Number.
 * @returns Julian Century (T).
 */
function julianCentury(jd: number): number {
  return (jd - 2451545) / 36525;
}

/**
 * Computes the sun's declination and equation of time for a given Julian Century.
 *
 * @param T - Julian Century.
 * @returns Object with declinationDeg and eqOfTimeMin.
 */
function solarGeometry(T: number): { declinationDeg: number; eqOfTimeMin: number } {
  // Geometric mean longitude of the sun (degrees).
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;

  // Geometric mean anomaly of the sun (degrees).
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const MRad = M * DEG_TO_RAD;

  // Eccentricity of Earth's orbit.
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  // Sun's equation of center (degrees).
  const C =
    Math.sin(MRad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * MRad) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * MRad) * 0.000289;

  // Sun's true longitude and apparent longitude (degrees).
  const sunTrueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG_TO_RAD);

  // Mean obliquity of the ecliptic (degrees).
  const meanObliq = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * Math.cos(omega * DEG_TO_RAD);
  const obliqCorrRad = obliqCorr * DEG_TO_RAD;

  // Sun's declination (degrees).
  const declinationDeg =
    Math.asin(Math.sin(obliqCorrRad) * Math.sin(sunAppLong * DEG_TO_RAD)) * RAD_TO_DEG;

  // Equation of time (minutes).
  const y = Math.tan(obliqCorrRad / 2) * Math.tan(obliqCorrRad / 2);
  const L0Rad = L0 * DEG_TO_RAD;
  const eqOfTimeMin =
    4 *
    RAD_TO_DEG *
    (y * Math.sin(2 * L0Rad) -
      2 * e * Math.sin(MRad) +
      4 * e * y * Math.sin(MRad) * Math.cos(2 * L0Rad) -
      0.5 * y * y * Math.sin(4 * L0Rad) -
      1.25 * e * e * Math.sin(2 * MRad));

  return { declinationDeg, eqOfTimeMin };
}

/**
 * Computes the hour angle for a given zenith, latitude, and solar declination.
 * Returns undefined if the event does not occur (sun stays above or below the
 * zenith angle all day).
 *
 * @param zenithDeg - Zenith angle in degrees.
 * @param latDeg - Observer latitude in degrees.
 * @param declinationDeg - Sun's declination in degrees.
 * @returns Hour angle in degrees, or undefined if the event does not occur.
 */
function hourAngle(zenithDeg: number, latDeg: number, declinationDeg: number): number | undefined {
  const latRad = latDeg * DEG_TO_RAD;
  const declRad = declinationDeg * DEG_TO_RAD;
  const cosHA =
    (Math.cos(zenithDeg * DEG_TO_RAD) - Math.sin(latRad) * Math.sin(declRad)) /
    (Math.cos(latRad) * Math.cos(declRad));

  // cosHA > 1: sun never reaches this zenith (always below, e.g. polar night).
  // cosHA < -1: sun never dips to this zenith (always above, e.g. midnight sun).
  if (cosHA > 1 || cosHA < -1) {
    return undefined;
  }
  return Math.acos(cosHA) * RAD_TO_DEG;
}

/**
 * Converts minutes from midnight UTC into a Date object for the given base date.
 *
 * @param year - UTC year.
 * @param month - UTC month (0-11, JS convention).
 * @param day - UTC day of month.
 * @param minutesUtc - Minutes from midnight UTC (may exceed 1440 or be negative for cross-day events).
 * @returns Date object in UTC.
 */
function minutesToDate(year: number, month: number, day: number, minutesUtc: number): Date {
  const hours = Math.floor(minutesUtc / 60);
  const mins = Math.floor(minutesUtc % 60);
  const secs = Math.round((minutesUtc % 1) * 60);
  return new Date(Date.UTC(year, month, day, hours, mins, secs));
}

/**
 * Computes sunrise, sunset, and civil twilight times for a given geographic
 * position and UTC date.
 *
 * Uses the NOAA solar calculator algorithm. Results are accurate to within
 * approximately one minute for dates between 1901 and 2099.
 *
 * In polar regions, some or all events may not occur on a given date. When an
 * event does not occur, the corresponding property is omitted from the result.
 *
 * @param lat - Observer latitude in decimal degrees (positive north).
 * @param lon - Observer longitude in decimal degrees (positive east).
 * @param date - UTC date for which to compute solar times.
 * @returns Solar times (sunrise, sunset, civil twilight begin/end) in UTC.
 */
export function computeSolarTimes(lat: number, lon: number, date: Date): SolarTimes {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-11
  const day = date.getUTCDate();

  // Julian Day for noon UTC on the given date.
  const jd = julianDay(year, month + 1, day);
  const T = julianCentury(jd);
  const { declinationDeg, eqOfTimeMin } = solarGeometry(T);

  // Solar noon in minutes from midnight UTC.
  const solarNoonMin = 720 - 4 * lon - eqOfTimeMin;

  const result: SolarTimes = {};

  // Sunrise and sunset (zenith 90.833 degrees).
  const haSunrise = hourAngle(SUNRISE_SUNSET_ZENITH, lat, declinationDeg);
  if (haSunrise !== undefined) {
    result.sunrise = minutesToDate(year, month, day, solarNoonMin - haSunrise * 4);
    result.sunset = minutesToDate(year, month, day, solarNoonMin + haSunrise * 4);
  }

  // Civil twilight (zenith 96 degrees).
  const haTwilight = hourAngle(CIVIL_TWILIGHT_ZENITH, lat, declinationDeg);
  if (haTwilight !== undefined) {
    result.civilTwilightBegin = minutesToDate(year, month, day, solarNoonMin - haTwilight * 4);
    result.civilTwilightEnd = minutesToDate(year, month, day, solarNoonMin + haTwilight * 4);
  }

  return result;
}

/**
 * Determines whether a given UTC timestamp at a given position is during
 * daytime or nighttime per FAR 1.1 definitions.
 *
 * FAR 1.1 defines "night" as the time between the end of evening civil twilight
 * and the beginning of morning civil twilight. Therefore, daytime includes the
 * civil twilight periods (dawn and dusk).
 *
 * In polar regions where civil twilight does not occur:
 * - If the sun is continuously above the civil twilight angle, the entire day
 *   is considered daytime (returns true).
 * - If the sun is continuously below the civil twilight angle, the entire day
 *   is considered nighttime (returns false).
 *
 * @param lat - Observer latitude in decimal degrees (positive north).
 * @param lon - Observer longitude in decimal degrees (positive east).
 * @param dateTime - UTC timestamp to evaluate.
 * @returns True if the timestamp falls during daytime (including civil twilight), false if nighttime.
 */
export function isDaytime(lat: number, lon: number, dateTime: Date): boolean {
  const times = computeSolarTimes(lat, lon, dateTime);

  // If civil twilight times exist, check if the time falls within.
  if (times.civilTwilightBegin !== undefined && times.civilTwilightEnd !== undefined) {
    const t = dateTime.getTime();
    return t >= times.civilTwilightBegin.getTime() && t <= times.civilTwilightEnd.getTime();
  }

  // Polar edge case: determine if the sun is continuously above or below
  // the civil twilight angle by checking solar elevation at noon.
  const year = dateTime.getUTCFullYear();
  const month = dateTime.getUTCMonth();
  const day = dateTime.getUTCDate();
  const jd = julianDay(year, month + 1, day);
  const T = julianCentury(jd);
  const { declinationDeg } = solarGeometry(T);

  // Maximum solar elevation at solar noon = 90 - |lat - declination|.
  // If max elevation > (90 - 96) = -6 degrees, sun gets above civil twilight angle at some point.
  // But since we got no twilight times, the sun is either always above or always below.
  // If lat and declination are on the same side, sun stays high (midnight sun region) = daytime.
  const maxElevation = 90 - Math.abs(lat - declinationDeg);
  return maxElevation > -(CIVIL_TWILIGHT_ZENITH - 90);
}
