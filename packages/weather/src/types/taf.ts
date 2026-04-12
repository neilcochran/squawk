import type { DayTime, SkyCondition, Visibility, WeatherPhenomenon, Wind } from './shared.js';

/**
 * TAF-specific types for Terminal Aerodrome Forecast reports.
 */

/**
 * TAF change group type indicating how conditions are expected to change.
 *
 * - `FM` - From: conditions expected to change significantly at the specified time
 * - `TEMPO` - Temporary: fluctuations expected for less than 1 hour at a time
 *   and less than half of the period
 * - `BECMG` - Becoming: conditions expected to gradually change during the period
 */
export type TafChangeType = 'FM' | 'TEMPO' | 'BECMG';

/**
 * Maps TAF change type codes to human-readable descriptions.
 */
export const TAF_CHANGE_TYPE_MAP: Record<TafChangeType, string> = {
  FM: 'From',
  TEMPO: 'Temporary',
  BECMG: 'Becoming',
};

/**
 * Low-level wind shear as reported in a US TAF (WS group).
 * Indicates non-convective wind shear at or below 2,000 feet AGL.
 *
 * Format: `WS###/dddssKT` where ### is altitude in hundreds of feet,
 * ddd is wind direction, and ss is wind speed.
 */
export interface TafWindShear {
  /** Altitude of the wind shear layer in feet AGL (hundreds of feet multiplied by 100). */
  altitudeFtAgl: number;
  /** Wind direction in degrees true at the shear altitude. */
  directionDeg: number;
  /** Wind speed in knots at the shear altitude. */
  speedKt: number;
}

/**
 * Turbulence intensity code as used in US Military TAF turbulence groups (5-group).
 *
 * - `0` - None
 * - `1` - Light turbulence
 * - `2` - Moderate turbulence in clear air, occasional
 * - `3` - Moderate turbulence in clear air, frequent
 * - `4` - Moderate turbulence in cloud, occasional
 * - `5` - Moderate turbulence in cloud, frequent
 * - `6` - Severe turbulence in clear air, occasional
 * - `7` - Severe turbulence in clear air, frequent
 * - `8` - Severe turbulence in cloud, occasional
 * - `9` - Extreme turbulence
 */
export type TurbulenceIntensity = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Maps turbulence intensity codes to human-readable descriptions.
 */
export const TURBULENCE_INTENSITY_MAP: Record<TurbulenceIntensity, string> = {
  0: 'None',
  1: 'Light',
  2: 'Moderate in clear air, occasional',
  3: 'Moderate in clear air, frequent',
  4: 'Moderate in cloud, occasional',
  5: 'Moderate in cloud, frequent',
  6: 'Severe in clear air, occasional',
  7: 'Severe in clear air, frequent',
  8: 'Severe in cloud, occasional',
  9: 'Extreme',
};

/**
 * Icing intensity code as used in US Military TAF icing groups (6-group).
 *
 * - `0` - None
 * - `1` - Light icing
 * - `2` - Light icing in cloud
 * - `3` - Light icing in precipitation
 * - `4` - Moderate icing
 * - `5` - Moderate icing in cloud
 * - `6` - Moderate icing in precipitation
 * - `7` - Severe icing
 * - `8` - Severe icing in cloud
 * - `9` - Severe icing in precipitation
 */
export type IcingIntensity = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Maps icing intensity codes to human-readable descriptions.
 */
export const ICING_INTENSITY_MAP: Record<IcingIntensity, string> = {
  0: 'None',
  1: 'Light',
  2: 'Light in cloud',
  3: 'Light in precipitation',
  4: 'Moderate',
  5: 'Moderate in cloud',
  6: 'Moderate in precipitation',
  7: 'Severe',
  8: 'Severe in cloud',
  9: 'Severe in precipitation',
};

/**
 * Turbulence layer as reported in a US Military TAF (5-group).
 *
 * Format: `5BhshshsD` where B is intensity (0-9), hshshs is the base altitude
 * in hundreds of feet, and D is the layer depth in thousands of feet.
 */
export interface TafTurbulenceLayer {
  /** Turbulence intensity code (0-9). */
  intensity: TurbulenceIntensity;
  /** Base altitude of the turbulence layer in feet (hundreds of feet multiplied by 100). */
  baseAltitudeFt: number;
  /** Depth of the turbulence layer in feet (thousands of feet multiplied by 1,000). */
  depthFt: number;
}

/**
 * Icing layer as reported in a US Military TAF (6-group).
 *
 * Format: `6IhshshsD` where I is intensity (0-9), hshshs is the base altitude
 * in hundreds of feet, and D is the layer depth in thousands of feet.
 */
export interface TafIcingLayer {
  /** Icing intensity code (0-9). */
  intensity: IcingIntensity;
  /** Base altitude of the icing layer in feet (hundreds of feet multiplied by 100). */
  baseAltitudeFt: number;
  /** Depth of the icing layer in feet (thousands of feet multiplied by 1,000). */
  depthFt: number;
}

/**
 * A single TAF forecast group representing either the base (initial) forecast
 * or a change group (FM, TEMPO, BECMG, or PROB).
 *
 * The base forecast has no `changeType` and inherits the TAF's overall validity period.
 * Change groups specify when and how conditions are expected to deviate from the base.
 */
export interface TafForecastGroup {
  /** Type of change group. Undefined for the base (initial) forecast. */
  changeType?: TafChangeType;
  /** Probability percentage for PROB groups (30 or 40). Only used with TEMPO or standalone PROB. */
  probability?: 30 | 40;
  /** Start time for this group's validity period. FM groups include minute; TEMPO/BECMG use day+hour with minute 0. Absent on the base forecast. */
  start?: DayTime;
  /** End time for this group's validity period (TEMPO/BECMG/PROB only). Uses day+hour with minute 0. */
  end?: DayTime;
  /** True when CAVOK (Ceiling And Visibility OK) is reported in this group. */
  isCavok: boolean;
  /** True when NSW (No Significant Weather) is reported, indicating the end of weather phenomena. */
  isNoSignificantWeather: boolean;
  /** Wind information forecast for this period. */
  wind?: Wind;
  /** Prevailing visibility forecast for this period. */
  visibility?: Visibility;
  /** Weather phenomena groups forecast for this period. Empty array when none are forecast. */
  weather: WeatherPhenomenon[];
  /** Sky condition forecast for this period. */
  sky: SkyCondition;
  /** Low-level wind shear (WS group), if forecast. */
  windShear?: TafWindShear;
  /** Turbulence layers (5-group), used in US Military TAFs. */
  turbulence?: TafTurbulenceLayer[];
  /** Icing layers (6-group), used in US Military TAFs. */
  icing?: TafIcingLayer[];
}

/**
 * A parsed TAF (Terminal Aerodrome Forecast).
 *
 * A TAF provides weather forecasts for a specific airport, typically covering
 * a 24 or 30 hour period. The forecast consists of a base forecast followed
 * by zero or more change groups indicating expected weather transitions.
 */
export interface Taf {
  /** The original raw TAF string as provided to the parser. */
  raw: string;
  /** ICAO station identifier (e.g. "KJFK", "EGLL", "PANC"). */
  stationId: string;
  /** Time (UTC) when the forecast was issued. Day is always present. */
  issuedAt: DayTime;
  /** True when the TAF is an amendment to a previously issued forecast (AMD). */
  isAmended: boolean;
  /** True when the TAF is a correction to a previously issued forecast (COR). */
  isCorrected: boolean;
  /** True when the TAF has been cancelled (CNL). */
  isCancelled: boolean;
  /** Start of the overall forecast validity period (UTC). Uses day+hour with minute 0. */
  validFrom: DayTime;
  /** End of the overall forecast validity period (UTC). Uses day+hour with minute 0. */
  validTo: DayTime;
  /** Forecast groups. The first element is always the base forecast (no changeType). Empty when cancelled. */
  forecast: TafForecastGroup[];
}
