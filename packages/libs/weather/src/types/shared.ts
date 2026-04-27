/**
 * Shared weather types reused by METAR, TAF, SIGMET, AIRMET, and PIREP formats.
 */

/**
 * A UTC day/hour/minute time reference used across weather products.
 * The day field is optional because some time references omit it
 * (e.g. "0200Z" has only hour and minute, while "050200Z" includes the day).
 */
export interface DayTime {
  /** Day of month (UTC, 1-31). Omitted when the time reference has no day component. */
  day?: number;
  /** Hour (UTC, 0-23). */
  hour: number;
  /** Minute (UTC, 0-59). */
  minute: number;
}

/**
 * Standard 16-point compass direction used in METAR sector visibility,
 * SIGMET movement, and other directional observations.
 */
export type CompassDirection =
  | 'N'
  | 'NNE'
  | 'NE'
  | 'ENE'
  | 'E'
  | 'ESE'
  | 'SE'
  | 'SSE'
  | 'S'
  | 'SSW'
  | 'SW'
  | 'WSW'
  | 'W'
  | 'WNW'
  | 'NW'
  | 'NNW';

/**
 * Flight category derived from ceiling and visibility conditions.
 *
 * - `VFR` - Visual Flight Rules: ceiling above 3,000 ft AND visibility above 5 SM
 * - `MVFR` - Marginal VFR: ceiling 1,000-3,000 ft AND/OR visibility 3-5 SM
 * - `IFR` - Instrument Flight Rules: ceiling 500-999 ft AND/OR visibility 1-2 SM
 * - `LIFR` - Low IFR: ceiling below 500 ft AND/OR visibility below 1 SM
 */
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

/**
 * Wind information as reported in a METAR, SPECI, or TAF forecast group.
 */
export interface Wind {
  /** Wind direction in degrees true (0-360). Undefined when wind is variable (VRB) or calm. */
  directionDeg?: number;
  /** True when wind direction is reported as variable (VRB). */
  isVariable: boolean;
  /** True when wind is calm (00000KT). */
  isCalm: boolean;
  /** Sustained wind speed in knots. */
  speedKt: number;
  /** Gust speed in knots, if gusting. */
  gustKt?: number;
  /** Lower bound of variable wind direction range in degrees (e.g. 200 in 200V270). */
  variableFromDeg?: number;
  /** Upper bound of variable wind direction range in degrees (e.g. 270 in 200V270). */
  variableToDeg?: number;
}

/**
 * Prevailing visibility as reported in a METAR, SPECI, or TAF forecast group.
 */
export interface Visibility {
  /** Prevailing visibility in statute miles (US format). */
  visibilitySm?: number;
  /** Prevailing visibility in meters (ICAO format). */
  visibilityM?: number;
  /** True when visibility is reported as less than the stated value (M prefix in US METARs). */
  isLessThan: boolean;
  /** True when visibility is reported as greater than the stated value (P prefix, e.g. P6SM in TAFs). */
  isMoreThan: boolean;
}

/**
 * Intensity qualifier for a weather phenomenon group.
 *
 * - `LIGHT` - light intensity (- prefix)
 * - `MODERATE` - moderate intensity (no prefix)
 * - `HEAVY` - heavy intensity (+ prefix)
 */
export type WeatherIntensity = 'LIGHT' | 'MODERATE' | 'HEAVY';

/**
 * Descriptor qualifier that precedes a precipitation or obscuration type
 * in a weather phenomenon group.
 *
 * - `MI` - Shallow
 * - `PR` - Partial
 * - `BC` - Patches
 * - `DR` - Low drifting
 * - `BL` - Blowing
 * - `SH` - Showers
 * - `TS` - Thunderstorm
 * - `FZ` - Freezing
 */
export type WeatherDescriptor = 'MI' | 'PR' | 'BC' | 'DR' | 'BL' | 'SH' | 'TS' | 'FZ';

/**
 * Maps weather descriptor codes to human-readable descriptions.
 */
export const WEATHER_DESCRIPTOR_MAP: Record<WeatherDescriptor, string> = {
  MI: 'Shallow',
  PR: 'Partial',
  BC: 'Patches',
  DR: 'Low Drifting',
  BL: 'Blowing',
  SH: 'Showers',
  TS: 'Thunderstorm',
  FZ: 'Freezing',
};

/**
 * Individual weather phenomenon code as defined by METAR/TAF standards.
 *
 * Precipitation types:
 * - `DZ` - Drizzle
 * - `RA` - Rain
 * - `SN` - Snow
 * - `SG` - Snow grains
 * - `IC` - Ice crystals (diamond dust)
 * - `PL` - Ice pellets (sleet)
 * - `GR` - Hail (diameter >= 1/4 inch)
 * - `GS` - Small hail / snow pellets (diameter < 1/4 inch)
 * - `UP` - Unknown precipitation (automated stations)
 *
 * Obscuration types:
 * - `BR` - Mist (visibility 5/8 SM to 6 SM)
 * - `FG` - Fog (visibility below 5/8 SM)
 * - `FU` - Smoke
 * - `VA` - Volcanic ash
 * - `DU` - Widespread dust
 * - `SA` - Sand
 * - `HZ` - Haze
 * - `PY` - Spray
 *
 * Other phenomena:
 * - `PO` - Dust/sand whirls (dust devils)
 * - `SQ` - Squall
 * - `FC` - Funnel cloud (tornado or waterspout)
 * - `SS` - Sandstorm
 * - `DS` - Dust storm
 */
export type WeatherPhenomenonCode =
  | 'DZ'
  | 'RA'
  | 'SN'
  | 'SG'
  | 'IC'
  | 'PL'
  | 'GR'
  | 'GS'
  | 'UP'
  | 'BR'
  | 'FG'
  | 'FU'
  | 'VA'
  | 'DU'
  | 'SA'
  | 'HZ'
  | 'PY'
  | 'PO'
  | 'SQ'
  | 'FC'
  | 'SS'
  | 'DS';

/**
 * Maps weather phenomenon codes to human-readable descriptions.
 */
export const WEATHER_PHENOMENON_MAP: Record<WeatherPhenomenonCode, string> = {
  DZ: 'Drizzle',
  RA: 'Rain',
  SN: 'Snow',
  SG: 'Snow Grains',
  IC: 'Ice Crystals',
  PL: 'Ice Pellets',
  GR: 'Hail',
  GS: 'Small Hail/Snow Pellets',
  UP: 'Unknown Precipitation',
  BR: 'Mist',
  FG: 'Fog',
  FU: 'Smoke',
  VA: 'Volcanic Ash',
  DU: 'Widespread Dust',
  SA: 'Sand',
  HZ: 'Haze',
  PY: 'Spray',
  PO: 'Dust/Sand Whirls',
  SQ: 'Squall',
  FC: 'Funnel Cloud',
  SS: 'Sandstorm',
  DS: 'Dust Storm',
};

/**
 * A parsed weather phenomenon group from a METAR, SPECI, or TAF.
 * Each group encodes intensity, an optional descriptor, and one or more
 * phenomenon types (e.g. "+TSRA" = heavy thunderstorm rain).
 */
export interface WeatherPhenomenon {
  /** The raw weather group string as it appeared in the report (e.g. "+TSRA", "VCSH", "-DZ"). */
  raw: string;
  /** Intensity of the weather phenomenon. */
  intensity: WeatherIntensity;
  /** True when the phenomenon is reported in the vicinity (VC prefix), not at the station. */
  isVicinity: boolean;
  /** Descriptor qualifier, if present (e.g. TS, SH, FZ, BL). */
  descriptor?: WeatherDescriptor;
  /** One or more weather phenomenon codes in this group (e.g. [RA], [RA, SN], [GR]). */
  phenomena: WeatherPhenomenonCode[];
}

/**
 * Cloud coverage amount as reported in a sky condition group.
 *
 * - `FEW` - Few (1/8 to 2/8 coverage)
 * - `SCT` - Scattered (3/8 to 4/8 coverage)
 * - `BKN` - Broken (5/8 to 7/8 coverage)
 * - `OVC` - Overcast (8/8 coverage)
 */
export type CloudCoverage = 'FEW' | 'SCT' | 'BKN' | 'OVC';

/**
 * Maps cloud coverage codes to human-readable descriptions.
 */
export const CLOUD_COVERAGE_MAP: Record<CloudCoverage, string> = {
  FEW: 'Few',
  SCT: 'Scattered',
  BKN: 'Broken',
  OVC: 'Overcast',
};

/**
 * Significant cloud type modifier reported with a cloud layer.
 *
 * - `CB` - Cumulonimbus (thunderstorm clouds)
 * - `TCU` - Towering cumulus
 */
export type CloudType = 'CB' | 'TCU';

/**
 * A single cloud layer as reported in a sky condition group.
 */
export interface CloudLayer {
  /** Cloud coverage amount for this layer. */
  coverage: CloudCoverage;
  /** Cloud base altitude in feet AGL (hundreds of feet as reported, multiplied by 100). */
  altitudeFtAgl: number;
  /** Significant cloud type modifier, if reported. */
  type?: CloudType;
}

/**
 * Clear sky indicator type.
 *
 * - `CLR` - Clear below 12,000 ft (used by automated stations)
 * - `SKC` - Sky clear (used by manual observations)
 */
export type SkyClearType = 'CLR' | 'SKC';

/**
 * Sky condition as reported in a METAR, SPECI, or TAF.
 * Contains cloud layers and/or special indicators for clear sky or vertical visibility.
 */
export interface SkyCondition {
  /** Cloud layers reported, ordered by ascending altitude. Empty when sky is clear or only vertical visibility is reported. */
  layers: CloudLayer[];
  /** Vertical visibility in feet AGL, reported when the sky is obscured (VVxxx). */
  verticalVisibilityFtAgl?: number;
  /** Clear sky indicator, if reported. */
  clear?: SkyClearType;
}

/**
 * Altimeter setting as reported in a METAR or SPECI.
 * US stations report in inches of mercury (A group), ICAO stations report in hectopascals (Q group).
 * Some reports may include both.
 */
export interface Altimeter {
  /** Altimeter setting in inches of mercury (US A group, e.g. A2992 = 29.92 inHg). */
  inHg?: number;
  /** Altimeter setting in hectopascals / millibars (ICAO Q group, e.g. Q1013 = 1013 hPa). */
  hPa?: number;
}

/**
 * Altitude range used in SIGMETs and AIRMETs, typically expressed as
 * "BTN FL350 AND FL410" or "BTN SFC AND FL100".
 */
export interface AltitudeRange {
  /** Base altitude in feet MSL. Undefined when the base is the surface (SFC) or the freezing level (see baseIsFreezingLevel). */
  baseFt?: number;
  /** Top altitude in feet MSL. */
  topFt: number;
  /** True when the base altitude is the freezing level rather than a fixed altitude. When set, baseFt is undefined because the freezing level varies geographically. */
  baseIsFreezingLevel?: boolean;
}
