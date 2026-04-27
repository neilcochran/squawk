/**
 * Types for the FD (Forecast Winds and Temperatures Aloft) text product.
 *
 * FD bulletins are issued several times daily by NWS/AWC per geographic
 * region and altitude band, giving forecast wind direction, wind speed,
 * and (usually) temperature at each of a fixed set of altitudes for a
 * fixed list of reporting stations. The text product is sometimes
 * referred to by its older name "FB".
 */

import type { DayTime } from './shared.js';

/**
 * Parsed FD winds-aloft forecast bulletin. `wmoHeader` and `productCode`
 * are optional because bulletins sourced from non-AWC feeds may omit the
 * wire-format preamble lines.
 */
export interface WindsAloftForecast {
  /** Original raw bulletin text, preserved verbatim. */
  raw: string;
  /** Time the forecast data was based on (UTC). */
  basedOn: DayTime;
  /** Time the forecast becomes valid (UTC). */
  validAt: DayTime;
  /** Start time (UTC, hour + minute) of the forecast usable period, from "FOR USE HHMM-HHMMZ". The `day` field is always undefined because the FD format omits it. */
  useFrom: DayTime;
  /** End time (UTC, hour + minute) of the forecast usable period. The `day` field is always undefined because the FD format omits it. */
  useTo: DayTime;
  /** Altitude above which forecast temperatures are implicitly negative (feet MSL). */
  negativeTempsAboveFt: number;
  /** Altitude columns in feet MSL, in the order they appear in the bulletin. */
  altitudesFt: number[];
  /** Per-station forecast rows in input order. */
  stations: WindsAloftStationForecast[];
  /** WMO bulletin header line (e.g. "FBUS31 KWNO 241359"), when present. */
  wmoHeader?: string;
  /** AWC product code line (e.g. "FD1US1"), when present. */
  productCode?: string;
}

/**
 * Forecast row for a single reporting station. `levels` is aligned 1:1
 * with {@link WindsAloftForecast.altitudesFt}.
 */
export interface WindsAloftStationForecast {
  /** Station identifier (typically a 3-character FAA or 4-letter ICAO code). */
  stationId: string;
  /** Per-altitude level entries. Same length and order as {@link WindsAloftForecast.altitudesFt}. */
  levels: WindsAloftLevel[];
}

/**
 * Wind and optional temperature forecast at a single altitude for a single
 * station.
 *
 * Light-and-variable winds (raw code "9900") are flagged via
 * {@link WindsAloftLevel.isLightAndVariable | isLightAndVariable} with
 * `directionDeg` and `speedKt` left undefined, because the underlying
 * product only indicates "< 5 kt, variable direction" - it does not
 * commit to a specific value.
 *
 * Missing entries (where the station is too low or too high for the
 * altitude column) are flagged via
 * {@link WindsAloftLevel.isMissing | isMissing} with all data fields
 * left undefined.
 */
export interface WindsAloftLevel {
  /** Altitude in feet MSL for this entry. */
  altitudeFt: number;
  /** True when the station has no forecast at this altitude (blank column in the bulletin). */
  isMissing: boolean;
  /** True when the wind is reported as light and variable (raw code "9900"). */
  isLightAndVariable: boolean;
  /** Wind direction in degrees true (10-360). Undefined when missing or light and variable. */
  directionDeg?: number;
  /** Wind speed in knots. Undefined when missing or light and variable. */
  speedKt?: number;
  /** Forecast temperature in Celsius. Absent for the lowest altitude columns (typically below 5000 ft) and for missing entries. */
  temperatureC?: number;
}
