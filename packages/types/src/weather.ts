import type { Coordinates } from './position.js';

// ---------------------------------------------------------------------------
// Shared weather types - reused by METAR, TAF, SIGMET, and other weather formats
// ---------------------------------------------------------------------------

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
  statuteMiles?: number;
  /** Prevailing visibility in meters (ICAO format). */
  meters?: number;
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
  altitudeFt: number;
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
  verticalVisibilityFt?: number;
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

// ---------------------------------------------------------------------------
// METAR/SPECI-specific types
// ---------------------------------------------------------------------------

/**
 * The type of weather observation report.
 *
 * - `METAR` - Routine scheduled aviation weather observation
 * - `SPECI` - Special unscheduled observation issued when significant weather changes occur
 */
export type MetarType = 'METAR' | 'SPECI';

/**
 * Runway Visual Range (RVR) visibility trend indicator.
 *
 * - `RISING` - RVR is increasing (U suffix)
 * - `FALLING` - RVR is decreasing (D suffix)
 * - `NO_CHANGE` - RVR is steady (N suffix)
 */
export type RvrTrend = 'RISING' | 'FALLING' | 'NO_CHANGE';

/**
 * Runway Visual Range (RVR) report for a specific runway.
 * Reports the horizontal visibility along a runway measured by transmissometers.
 */
export interface RunwayVisualRange {
  /** Runway designator (e.g. "27L", "09R", "15"). */
  runway: string;
  /** Reported RVR visibility in feet. When variable, this is the lower bound. */
  visibilityFt: number;
  /** True when the visibility value has a P (plus) prefix, indicating "greater than" the sensor maximum (e.g. P6000FT). */
  isMoreThan: boolean;
  /** True when the visibility value has an M (minus) prefix, indicating "less than" the sensor minimum (e.g. M0200FT). */
  isLessThan: boolean;
  /** Upper bound of variable RVR in feet (e.g. 3000 in R27R/1800V3000FT). */
  variableMaxFt?: number;
  /** True when the variable max value has a P (plus) prefix (e.g. VP6000FT). */
  isVariableMaxMoreThan?: boolean;
  /** Visibility trend indicator, if reported. */
  trend?: RvrTrend;
}

/**
 * Automated weather station type as reported in METAR remarks.
 *
 * - `AO1` - Automated station without a precipitation discriminator
 * - `AO2` - Automated station with a precipitation discriminator
 */
export type StationType = 'AO1' | 'AO2';

/**
 * Peak wind information from the METAR remarks section (PK WND group).
 */
export interface PeakWind {
  /** Peak wind direction in degrees true. */
  directionDeg: number;
  /** Peak wind speed in knots. */
  speedKt: number;
  /** Time (UTC) when the peak wind occurred. When the raw report omits the hour, it is populated from the observation time. */
  time: DayTime;
}

/**
 * Variable visibility range from the METAR remarks section (VIS min V max).
 */
export interface VariableVisibility {
  /** Minimum visibility in statute miles. */
  minStatuteMiles: number;
  /** Maximum visibility in statute miles. */
  maxStatuteMiles: number;
}

/**
 * Variable ceiling range from the METAR remarks section (CIG min V max).
 */
export interface VariableCeiling {
  /** Minimum ceiling in feet AGL (hundreds of feet multiplied by 100). */
  minFt: number;
  /** Maximum ceiling in feet AGL (hundreds of feet multiplied by 100). */
  maxFt: number;
}

/**
 * Wind shift information from the METAR remarks section (WSHFT group).
 */
export interface WindShift {
  /** Time (UTC) when the wind shift occurred. When the raw report omits the hour, it is populated from the observation time. */
  time: DayTime;
  /** True when the wind shift was associated with a frontal passage (FROPA). */
  frontalPassage: boolean;
}

/**
 * Sector visibility from the METAR remarks section (VIS [dir] [value]).
 */
export interface SectorVisibility {
  /** Compass direction of the sector. */
  direction: CompassDirection;
  /** Visibility in statute miles for this sector. */
  statuteMiles: number;
}

/**
 * Precipitation begin/end event from the METAR remarks section.
 * Indicates when a specific weather phenomenon began or ended (e.g. RAB15E32).
 */
export interface PrecipitationEvent {
  /** Weather phenomenon code (e.g. "RA", "SN", "TS"). */
  phenomenon: string;
  /** "BEGIN" if the phenomenon began, "END" if it ended. */
  eventType: 'BEGIN' | 'END';
  /** Time (UTC) of the event. When the raw report omits the hour, it is populated from the observation time. */
  time: DayTime;
}

/**
 * Pressure tendency character code indicating the barometric trend over the past 3 hours.
 *
 * - `0` - Increasing, then decreasing
 * - `1` - Increasing, then steady, or increasing then increasing more slowly
 * - `2` - Increasing steadily or unsteadily
 * - `3` - Decreasing or steady, then increasing, or increasing then increasing more rapidly
 * - `4` - Steady
 * - `5` - Decreasing, then increasing
 * - `6` - Decreasing, then steady, or decreasing then decreasing more slowly
 * - `7` - Decreasing steadily or unsteadily
 * - `8` - Steady or increasing, then decreasing, or decreasing then decreasing more rapidly
 */
export type PressureTendencyCharacter = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Maps pressure tendency character codes to human-readable descriptions.
 */
export const PRESSURE_TENDENCY_MAP: Record<PressureTendencyCharacter, string> = {
  0: 'Increasing, then decreasing',
  1: 'Increasing, then steady or increasing more slowly',
  2: 'Increasing steadily or unsteadily',
  3: 'Decreasing or steady, then increasing; or increasing then increasing more rapidly',
  4: 'Steady',
  5: 'Decreasing, then increasing',
  6: 'Decreasing, then steady or decreasing more slowly',
  7: 'Decreasing steadily or unsteadily',
  8: 'Steady or increasing, then decreasing; or decreasing then decreasing more rapidly',
};

/**
 * Pressure tendency from the METAR remarks section (5appp group).
 * Reports the barometric pressure change over the past 3 hours.
 */
export interface PressureTendency {
  /** Character code indicating the nature of the pressure change (0-8). */
  character: PressureTendencyCharacter;
  /** Pressure change in hectopascals over the past 3 hours. */
  changeHpa: number;
}

/**
 * Ice accretion amount from the METAR remarks section (Ixnnn group).
 * Reports the amount of ice accumulation detected by a freezing rain sensor.
 */
export interface IceAccretion {
  /** The period in hours over which the ice accreted (1, 3, or 6). */
  periodHours: 1 | 3 | 6;
  /** Ice accretion amount in hundredths of an inch. */
  amountIn: number;
}

/**
 * Lightning observation frequency as reported in METAR remarks.
 *
 * - `FRQ` - Frequent (more than 6 flashes per minute)
 * - `OCNL` - Occasional (1 to 6 flashes per minute)
 * - `CONS` - Continuous (more than 6 flashes per minute with no break)
 */
export type LightningFrequency = 'FRQ' | 'OCNL' | 'CONS';

/**
 * Lightning type code as reported in METAR remarks.
 *
 * - `IC` - In-cloud lightning
 * - `CC` - Cloud-to-cloud lightning
 * - `CG` - Cloud-to-ground lightning
 * - `CA` - Cloud-to-air lightning
 */
export type LightningType = 'IC' | 'CC' | 'CG' | 'CA';

/**
 * Lightning observation from the METAR remarks section.
 * Reports the frequency, type(s), and location of observed lightning.
 */
export interface LightningObservation {
  /** Frequency of lightning. */
  frequency?: LightningFrequency;
  /** Lightning type codes observed. */
  types: LightningType[];
  /** Location/direction description (e.g. "OHD", "VC", "DSNT NW-N", "SW-W"). */
  location?: string;
}

/**
 * Thunderstorm location and movement from the METAR remarks section.
 */
export interface ThunderstormInfo {
  /** Location/direction of the thunderstorm (e.g. "OHD", "VC NW-N", "DSNT W"). */
  location?: string;
  /** Direction the thunderstorm is moving. */
  movingDirection?: CompassDirection;
}

/**
 * Virga observation from the METAR remarks section.
 */
export interface VirgaObservation {
  /** Compass direction where virga is observed (e.g. "SW-W", "N", "OHD"). */
  direction?: string;
}

/**
 * Variable sky condition from the METAR remarks section.
 * Reports that a cloud layer is varying between two coverage amounts.
 */
export interface VariableSkyCondition {
  /** Lower cloud coverage amount. */
  coverageLow: CloudCoverage;
  /** Higher cloud coverage amount. */
  coverageHigh: CloudCoverage;
  /** Cloud layer altitude in feet AGL. */
  altitudeFt: number;
}

/**
 * Significant cloud type code as reported in METAR remarks.
 *
 * - `CB` - Cumulonimbus
 * - `TCU` - Towering cumulus
 * - `ACC` - Altocumulus castellanus
 * - `ACSL` - Altocumulus standing lenticular
 * - `CCSL` - Cirrocumulus standing lenticular
 * - `SCSL` - Stratocumulus standing lenticular
 * - `CBMAM` - Cumulonimbus mammatus
 */
export type SignificantCloudType = 'CB' | 'TCU' | 'ACC' | 'ACSL' | 'CCSL' | 'SCSL' | 'CBMAM';

/**
 * Significant cloud type observed and reported in the METAR remarks section.
 * Covers cumulonimbus, towering cumulus, and standing lenticular cloud types.
 */
export interface SignificantCloudReport {
  /** Significant cloud type code. */
  type: SignificantCloudType;
  /** Location/direction from station (e.g. "DSNT W", "OHD", "NW-N"). */
  location?: string;
}

/**
 * Tower or surface visibility from the METAR remarks section (TWR VIS / SFC VIS).
 */
export interface TowerSurfaceVisibility {
  /** The source of the visibility observation ("TWR" for tower, "SFC" for surface). */
  source: 'TWR' | 'SFC';
  /** Visibility in statute miles. */
  statuteMiles: number;
}

/**
 * Visibility or ceiling observation at a secondary location (e.g. a specific runway).
 */
export interface SecondLocationObservation {
  /** The type of observation ("VIS" for visibility, "CIG" for ceiling). */
  type: 'VIS' | 'CIG';
  /** Value in statute miles (for VIS) or feet AGL (for CIG). */
  value: number;
  /** Location identifier (e.g. "RWY11", "RWY06"). */
  location: string;
}

/**
 * Surface-based obscuration observed and reported in the METAR remarks section.
 * Reports the obscuring phenomenon and its coverage at the surface.
 */
export interface ObscurationReport {
  /** The weather phenomenon causing the obscuration. */
  phenomenon: WeatherPhenomenonCode;
  /** Cloud coverage amount of the obscuration. */
  coverage: CloudCoverage;
  /** Height of the obscuration layer in feet AGL. */
  altitudeFt: number;
}

/**
 * Snow increasing rapidly from the METAR remarks section (SNINCR group).
 */
export interface SnowIncreasing {
  /** Snow depth increase in inches during the past hour. */
  lastHourIn: number;
  /** Total snow depth on the ground in inches. */
  totalDepthIn: number;
}

/**
 * Parsed METAR remarks section. Contains structured fields for commonly coded
 * remark groups. The raw remarks string is always available for any groups
 * not parsed into structured fields.
 */
export interface MetarRemarks {
  /** The full raw remarks string (everything after "RMK"). */
  raw: string;
  /** Automated station type (AO1 or AO2). */
  stationType?: StationType;
  /** Sea level pressure in millibars, derived from the SLP group (e.g. SLP189 = 1018.9 mb). */
  seaLevelPressureMb?: number;
  /** Precise temperature in degrees Celsius to tenths, from the T group (e.g. T01610100 = 16.1C). */
  preciseTemperatureC?: number;
  /** Precise dewpoint in degrees Celsius to tenths, from the T group (e.g. T01610100 = 10.0C). */
  preciseDewpointC?: number;
  /** Hourly precipitation amount in inches, from the P group (e.g. P0022 = 0.22 in). */
  hourlyPrecipitationIn?: number;
  /** 3-hour or 6-hour precipitation amount in inches, from the 6-group (e.g. 60048 = 0.48 in). */
  threeSixHourPrecipitationIn?: number;
  /** 24-hour precipitation amount in inches, from the 7-group (e.g. 70102 = 1.02 in). */
  twentyFourHourPrecipitationIn?: number;
  /** Snow depth on ground in inches, from the 4/group (e.g. 4/012 = 12 inches). */
  snowDepthIn?: number;
  /** 24-hour maximum temperature in degrees Celsius, from the 4-group (e.g. 401280028 max=12.8C). */
  twentyFourHourMaxTemperatureC?: number;
  /** 24-hour minimum temperature in degrees Celsius, from the 4-group (e.g. 401280028 min=0.28C). */
  twentyFourHourMinTemperatureC?: number;
  /** Peak wind observed during the observation period. */
  peakWind?: PeakWind;
  /** True when pressure is falling rapidly (PRESFR). */
  pressureFallingRapidly?: boolean;
  /** True when pressure is rising rapidly (PRESRR). */
  pressureRisingRapidly?: boolean;
  /** True when the maintenance indicator ($) is present, signaling the station needs maintenance. */
  maintenanceIndicator?: boolean;
  /** Variable visibility range observed during the period. */
  variableVisibility?: VariableVisibility;
  /** Variable ceiling range observed during the period. */
  variableCeiling?: VariableCeiling;
  /** Wind shift event information. */
  windShift?: WindShift;
  /** Sector visibility observations. */
  sectorVisibility?: SectorVisibility[];
  /** Precipitation begin/end events. */
  precipitationEvents?: PrecipitationEvent[];
  /**
   * Hail size in inches, from the GR remark (e.g. GR 1 3/4 = 1.75 in).
   * Only present when hail size is explicitly reported in remarks.
   */
  hailSizeIn?: number;
  /** 6-hour maximum temperature in degrees Celsius, from the 1-group (e.g. 10066 = 6.6C). */
  sixHourMaxTemperatureC?: number;
  /** 6-hour minimum temperature in degrees Celsius, from the 2-group (e.g. 21012 = -1.2C). */
  sixHourMinTemperatureC?: number;
  /** 3-hour pressure tendency from the 5-group (e.g. 52032 = character 2, +3.2 hPa). */
  pressureTendency?: PressureTendency;
  /** Ice accretion amounts from the I-group (e.g. I1001 = 0.01 in last hour). */
  iceAccretion?: IceAccretion[];
  /** Snow increasing rapidly from the SNINCR group (e.g. SNINCR 2/10). */
  snowIncreasing?: SnowIncreasing;
  /** Water equivalent of snow on ground in inches, from the 933-group (e.g. 933036 = 3.6 in). */
  waterEquivalentSnowIn?: number;
  /** True when sea level pressure is not available (SLPNO). */
  seaLevelPressureNotAvailable?: boolean;
  /** Lightning observations. */
  lightning?: LightningObservation[];
  /** Thunderstorm location and movement information. */
  thunderstormInfo?: ThunderstormInfo[];
  /** Virga observations with direction. */
  virga?: VirgaObservation[];
  /** Variable sky condition (layer varying between two coverages). */
  variableSkyCondition?: VariableSkyCondition[];
  /** Significant cloud types observed (CB, TCU, ACC, ACSL, CCSL, etc.). */
  significantClouds?: SignificantCloudReport[];
  /** Tower or surface visibility observations. */
  towerSurfaceVisibility?: TowerSurfaceVisibility[];
  /** Visibility or ceiling observations at secondary locations. */
  secondLocationObservations?: SecondLocationObservation[];
  /** Surface-based obscurations reported in remarks. */
  obscurations?: ObscurationReport[];
  /** List of sensor status codes indicating unavailable data (e.g. TSNO, PWINO, FZRANO, PNO, VISNO, CHINO). */
  missingData?: string[];
}

/**
 * A parsed METAR or SPECI aviation weather observation report.
 *
 * A METAR is a routine scheduled weather observation; a SPECI is an unscheduled
 * special observation triggered by significant weather changes. Both share the
 * same structure and are parsed by the same function.
 */
export interface Metar {
  /** The original raw METAR/SPECI string as provided to the parser. */
  raw: string;
  /** Whether this is a routine METAR or a special (SPECI) observation. */
  type: MetarType;
  /** ICAO station identifier (e.g. "KJFK", "EGLL", "PANC"). */
  stationId: string;
  /** Observation time (UTC). The day field is always present for METAR/SPECI. */
  observationTime: DayTime;
  /** True when the observation was produced by an automated station (AUTO). */
  isAutomated: boolean;
  /** True when the observation is a correction to a previously issued report (COR). */
  isCorrected: boolean;
  /** True when CAVOK (Ceiling And Visibility OK) is reported, primarily used in ICAO format. */
  isCavok: boolean;
  /** True when NOSIG (no significant change) is appended, primarily used in ICAO format. */
  isNoSignificantChange: boolean;
  /** Wind information. */
  wind?: Wind;
  /** Prevailing visibility. */
  visibility?: Visibility;
  /** Runway Visual Range reports. Empty array when no RVR is reported. */
  rvr: RunwayVisualRange[];
  /** Weather phenomena groups (e.g. rain, snow, fog, thunderstorm). Empty array when no weather is reported. */
  weather: WeatherPhenomenon[];
  /** Sky condition including cloud layers, vertical visibility, and clear sky indicators. */
  sky: SkyCondition;
  /** Temperature in whole degrees Celsius. */
  temperatureC?: number;
  /** Dewpoint temperature in whole degrees Celsius. */
  dewpointC?: number;
  /** Altimeter setting. */
  altimeter?: Altimeter;
  /** Parsed remarks section. Only present when the report contains a RMK group. */
  remarks?: MetarRemarks;
  /** Derived flight category based on ceiling and visibility (VFR, MVFR, IFR, LIFR). */
  flightCategory?: FlightCategory;
}

// ---------------------------------------------------------------------------
// TAF-specific types
// ---------------------------------------------------------------------------

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
  altitudeFt: number;
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

// ---------------------------------------------------------------------------
// SIGMET types
// ---------------------------------------------------------------------------

/**
 * NATO phonetic alphabet series name used to identify SIGMET series.
 *
 * CONUS non-convective SIGMETs use: NOVEMBER, OSCAR, PAPA, QUEBEC, ROMEO,
 * UNIFORM, VICTOR, WHISKEY, XRAY, YANKEE (SIERRA and TANGO are excluded).
 *
 * Oakland Oceanic FIR uses: ALFA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT,
 * GOLF, HOTEL.
 *
 * Anchorage FIR uses: INDIA, JULIET, KILO, LIMA, MIKE.
 *
 * Honolulu MWO uses the full NATO phonetic alphabet: NOVEMBER through ZULU.
 */
export type SigmetSeriesName =
  | 'ALFA'
  | 'BRAVO'
  | 'CHARLIE'
  | 'DELTA'
  | 'ECHO'
  | 'FOXTROT'
  | 'GOLF'
  | 'HOTEL'
  | 'INDIA'
  | 'JULIET'
  | 'KILO'
  | 'LIMA'
  | 'MIKE'
  | 'NOVEMBER'
  | 'OSCAR'
  | 'PAPA'
  | 'QUEBEC'
  | 'ROMEO'
  | 'SIERRA'
  | 'TANGO'
  | 'UNIFORM'
  | 'VICTOR'
  | 'WHISKEY'
  | 'XRAY'
  | 'YANKEE'
  | 'ZULU';

/**
 * SIGMET format discriminator indicating which of the three distinct
 * SIGMET message formats this object represents.
 *
 * - `CONVECTIVE` - Domestic convective SIGMET (CONUS thunderstorm advisories)
 * - `NONCONVECTIVE` - Domestic non-convective SIGMET (CONUS turbulence, icing, volcanic ash, dust/sandstorm)
 * - `INTERNATIONAL` - International ICAO format SIGMET (Alaska, oceanic FIRs, international airspace)
 */
export type SigmetFormat = 'CONVECTIVE' | 'NONCONVECTIVE' | 'INTERNATIONAL';

/**
 * Maps SIGMET format codes to human-readable descriptions.
 */
export const SIGMET_FORMAT_MAP: Record<SigmetFormat, string> = {
  CONVECTIVE: 'Convective',
  NONCONVECTIVE: 'Non-Convective',
  INTERNATIONAL: 'International (ICAO)',
};

/**
 * Hazard type for a non-convective SIGMET.
 *
 * - `TURBULENCE` - Severe or greater turbulence (SEV TURB)
 * - `ICING` - Severe icing (SEV ICE)
 * - `VOLCANIC_ASH` - Volcanic ash (VA)
 * - `DUST_SANDSTORM` - Widespread duststorm or sandstorm (WDSPR DS/SS)
 */
export type SigmetHazardType = 'TURBULENCE' | 'ICING' | 'VOLCANIC_ASH' | 'DUST_SANDSTORM';

/**
 * Maps SIGMET hazard type codes to human-readable descriptions.
 */
export const SIGMET_HAZARD_TYPE_MAP: Record<SigmetHazardType, string> = {
  TURBULENCE: 'Severe Turbulence',
  ICING: 'Severe Icing',
  VOLCANIC_ASH: 'Volcanic Ash',
  DUST_SANDSTORM: 'Dust/Sandstorm',
};

/**
 * Convective SIGMET region identifier for CONUS areas.
 *
 * - `E` - Eastern United States
 * - `C` - Central United States
 * - `W` - Western United States
 */
export type ConvectiveSigmetRegion = 'E' | 'C' | 'W';

/**
 * Maps convective SIGMET region codes to human-readable descriptions.
 */
export const CONVECTIVE_SIGMET_REGION_MAP: Record<ConvectiveSigmetRegion, string> = {
  E: 'Eastern',
  C: 'Central',
  W: 'Western',
};

/**
 * Thunderstorm spatial organization type in a convective SIGMET.
 *
 * - `AREA` - An area of thunderstorms
 * - `LINE` - A line of thunderstorms
 * - `ISOLATED` - Isolated thunderstorms
 */
export type ConvectiveThunderstormType = 'AREA' | 'LINE' | 'ISOLATED';

/**
 * Maps convective thunderstorm type codes to human-readable descriptions.
 */
export const CONVECTIVE_THUNDERSTORM_TYPE_MAP: Record<ConvectiveThunderstormType, string> = {
  AREA: 'Area',
  LINE: 'Line',
  ISOLATED: 'Isolated',
};

/**
 * Observation status for an international SIGMET phenomenon.
 *
 * - `OBSERVED` - The phenomenon has been observed (OBS)
 * - `FORECAST` - The phenomenon is forecast (FCST)
 */
export type SigmetObservationStatus = 'OBSERVED' | 'FORECAST';

/**
 * Intensity change trend for a SIGMET phenomenon.
 *
 * - `INTENSIFYING` - The phenomenon is intensifying (INTSF)
 * - `WEAKENING` - The phenomenon is weakening (WKN)
 * - `NO_CHANGE` - No change in intensity (NC)
 */
export type SigmetIntensityChange = 'INTENSIFYING' | 'WEAKENING' | 'NO_CHANGE';

/**
 * Maps SIGMET intensity change codes to human-readable descriptions.
 */
export const SIGMET_INTENSITY_CHANGE_MAP: Record<SigmetIntensityChange, string> = {
  INTENSIFYING: 'Intensifying',
  WEAKENING: 'Weakening',
  NO_CHANGE: 'No Change',
};

/**
 * Movement information for a SIGMET phenomenon.
 * Direction can be specified in degrees (domestic format) or as a compass
 * direction (international format).
 */
export interface SigmetMovement {
  /** Movement direction in degrees true (e.g. 260 from MOV FROM 26025KT). */
  directionDeg?: number;
  /** Movement direction as a compass point (e.g. NE, WSW from international format). */
  directionCompass?: CompassDirection;
  /** Movement speed in knots. Present when the speed is reported in knots. */
  speedKt?: number;
  /** Movement speed in kilometers per hour. Present when the speed is reported in KMH (some international MWOs). */
  speedKmh?: number;
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

/**
 * Cloud top information for a convective SIGMET.
 */
export interface SigmetTops {
  /** Cloud top altitude in feet MSL (flight level multiplied by 100). */
  altitudeFt: number;
  /** True when tops are reported as above the stated altitude (ABV FLxxx). */
  isAbove: boolean;
}

/**
 * A single hazard description within a non-convective SIGMET.
 * A SIGMET may contain multiple hazards (e.g. both icing and turbulence).
 */
export interface SigmetHazard {
  /** The type of weather hazard. */
  hazardType: SigmetHazardType;
  /** True when the hazard is preceded by OCNL (occasional). */
  isOccasional: boolean;
  /** Altitude range of the hazard (e.g. BTN FL280 AND FL380). */
  altitudeRange?: AltitudeRange;
  /** Cause of the hazard as stated in the DUE TO clause (e.g. "JTST", "FZRA", "WNDSHR ASSOCD WITH JTST"). */
  cause?: string;
  /** Visibility below a threshold in statute miles, for dust/sandstorm SIGMETs (VIS BLW 3SM). */
  visibilityBelow?: number;
}

/**
 * Outlook section appended to a convective SIGMET bulletin.
 * Provides a 2 to 6 hour forecast of expected convective activity.
 */
export interface ConvectiveSigmetOutlook {
  /** Start day of month (UTC) for the outlook valid period. */
  validFromDay: number;
  /** Start hour (UTC) for the outlook valid period. */
  validFromHour: number;
  /** Start minute (UTC) for the outlook valid period. */
  validFromMinute: number;
  /** End day of month (UTC) for the outlook valid period. */
  validToDay: number;
  /** End hour (UTC) for the outlook valid period. */
  validToHour: number;
  /** End minute (UTC) for the outlook valid period. */
  validToMinute: number;
  /** Area definition points for the outlook region (VOR-relative, e.g. "40E PXV", "CEW"). */
  areaPoints: string[];
  /** Full raw text of the outlook section. */
  text: string;
}

/**
 * A parsed domestic convective SIGMET.
 *
 * Convective SIGMETs are issued for the CONUS in place of SIGMETs for thunderstorms.
 * They are issued hourly for eastern, central, and western regions and are valid
 * for 2 hours. Each bulletin may include an outlook section.
 */
export interface ConvectiveSigmet {
  /** Discriminator indicating this is a convective SIGMET. */
  format: 'CONVECTIVE';
  /** The original raw SIGMET string as provided to the parser. */
  raw: string;
  /** CONUS region (Eastern, Central, or Western). */
  region: ConvectiveSigmetRegion;
  /** Sequence number for this convective SIGMET within its region. */
  number: number;
  /** True when this is a "CONVECTIVE SIGMET...NONE" issuance indicating no convective activity. */
  isNone: boolean;
  /** True when this is a standalone outlook without an active convective SIGMET. */
  isOutlookOnly: boolean;
  /** Time (UTC) until which this convective SIGMET is valid. */
  validUntil?: DayTime;
  /** US state abbreviations affected by the phenomena. */
  states?: string[];
  /** True when the affected area includes adjacent coastal waters. */
  coastalWaters?: boolean;
  /** Area definition points delineating the affected region (VOR-relative, e.g. "30NW ICT", "40S MCI"). */
  areaPoints?: string[];
  /** Thunderstorm spatial organization type. */
  thunderstormType?: ConvectiveThunderstormType;
  /** True when the thunderstorms are severe (SEV TS). */
  isSevere?: boolean;
  /** True when the thunderstorms are embedded (EMBD TS). */
  isEmbedded?: boolean;
  /** Width in nautical miles for a LINE of thunderstorms. */
  lineWidthNm?: number;
  /** Movement of the thunderstorm area. */
  movement?: SigmetMovement;
  /** Cloud top altitude information. */
  tops?: SigmetTops;
  /** True when tornadoes are possible. */
  hasTornadoes?: boolean;
  /** Maximum hail diameter in inches, if reported (e.g. 2.75 from "HAIL TO 2.75 IN"). */
  hailSizeIn?: number;
  /** Maximum wind gust speed in knots, if reported (e.g. 65 from "WIND GUSTS TO 65KT"). */
  windGustsKt?: number;
  /** Convective outlook section, if present. */
  outlook?: ConvectiveSigmetOutlook;
}

/**
 * A parsed domestic non-convective SIGMET for the CONUS.
 *
 * Non-convective SIGMETs are issued for severe turbulence, severe icing,
 * widespread dust/sandstorms, and volcanic ash. They are valid for up to
 * 4 hours and are reissued as needed. A single SIGMET may contain multiple
 * hazard descriptions.
 */
export interface NonConvectiveSigmet {
  /** Discriminator indicating this is a non-convective SIGMET. */
  format: 'NONCONVECTIVE';
  /** The original raw SIGMET string as provided to the parser. */
  raw: string;
  /** NATO phonetic series name (e.g. NOVEMBER, OSCAR, PAPA). */
  seriesName: SigmetSeriesName;
  /** Sequence number within the series. */
  seriesNumber: number;
  /** True when this SIGMET cancels a previously issued SIGMET. */
  isCancellation: boolean;
  /** Series name of the SIGMET being cancelled (when isCancellation is true). */
  cancelledSeriesName?: SigmetSeriesName;
  /** Series number of the SIGMET being cancelled (when isCancellation is true). */
  cancelledSeriesNumber?: number;
  /** Reason text for the cancellation (e.g. "CONDS MSTLY MOD", "CONDS HV ENDED"). */
  cancellationReason?: string;
  /** Time (UTC) until which this SIGMET is valid. */
  validUntil?: DayTime;
  /** US state abbreviations and area codes affected by the phenomena. */
  states?: string[];
  /** Area definition points delineating the affected region (VOR-relative, e.g. "30NW SLC", "60SE BOI"). */
  areaPoints?: string[];
  /** Weather hazards described in this SIGMET. Multiple hazards may be present in a single SIGMET. */
  hazards: SigmetHazard[];
  /** Movement of the hazard area. */
  movement?: SigmetMovement;
  /** Trend in intensity of the phenomena. */
  intensityChange?: SigmetIntensityChange;
  /** Time (UTC) beyond which conditions are expected to continue. */
  conditionsContinuingBeyond?: DayTime;
  /** Time (UTC) by which conditions are expected to end. */
  conditionsEndingBy?: DayTime;
  /** Name of the volcano for volcanic ash SIGMETs (e.g. "MT REDOUBT"). */
  volcanoName?: string;
  /** Geographic position of the volcano. */
  volcanoPosition?: Coordinates;
  /** Altitude range of the observed volcanic ash cloud. */
  ashCloudAltitudeRange?: AltitudeRange;
  /** Forecast time (UTC) for volcanic ash cloud position. */
  forecastTime?: DayTime;
  /** Forecast altitude range of the volcanic ash cloud. */
  forecastAltitudeRange?: AltitudeRange;
}

/**
 * A parsed international (ICAO format) SIGMET.
 *
 * International SIGMETs are used outside the CONUS, including Alaska,
 * oceanic FIRs, and international airspace. They follow the ICAO standard
 * format with FIR identification, validity periods, and standardized
 * phenomenon descriptions. Valid for up to 4 hours, or 6 hours for
 * volcanic ash and tropical cyclone SIGMETs.
 */
export interface InternationalSigmet {
  /** Discriminator indicating this is an international SIGMET. */
  format: 'INTERNATIONAL';
  /** The original raw SIGMET string as provided to the parser. */
  raw: string;
  /** ICAO identifier of the Flight Information Region (e.g. "PAZA", "KZMA"). */
  firCode: string;
  /** Name of the Flight Information Region (e.g. "ANCHORAGE FIR", "MIAMI OCEANIC FIR"). */
  firName: string;
  /** Series identifier. US MWOs use NATO phonetic names (e.g. MIKE, INDIA); non-US MWOs may use single letters or other identifiers per ICAO conventions. */
  seriesName: string;
  /** Sequence number within the series. */
  seriesNumber: number;
  /** ICAO identifier of the issuing station (e.g. "PANC", "KNHC"). */
  issuingStation: string;
  /** Start of the validity period (UTC). */
  validFrom: DayTime;
  /** End of the validity period (UTC). */
  validTo: DayTime;
  /** True when this SIGMET cancels a previously issued SIGMET. */
  isCancellation: boolean;
  /** Series identifier of the SIGMET being cancelled (when isCancellation is true). */
  cancelledSeriesName?: string;
  /** Series number of the SIGMET being cancelled (when isCancellation is true). */
  cancelledSeriesNumber?: number;
  /** Start of the cancelled SIGMET's validity period (UTC). */
  cancelledValidStart?: DayTime;
  /** End of the cancelled SIGMET's validity period (UTC). */
  cancelledValidEnd?: DayTime;
  /** Raw phenomena description string (e.g. "SEV TURB", "TC FRANCINE", "FRQ TS"). */
  phenomena?: string;
  /** Whether the phenomenon is observed or forecast. */
  observationStatus?: SigmetObservationStatus;
  /** Time (UTC) of observation. */
  observedAt?: DayTime;
  /** Raw area description text (WI coordinates, NM-based areas, etc.). */
  areaDescription?: string;
  /** Altitude range of the phenomenon. */
  altitudeRange?: AltitudeRange;
  /** Movement of the phenomenon. */
  movement?: SigmetMovement;
  /** True when the phenomenon is stationary (STNR). */
  isStationary?: boolean;
  /** Trend in intensity of the phenomenon. */
  intensityChange?: SigmetIntensityChange;
  /** Name of the tropical cyclone (e.g. "FRANCINE", "KYLE"). */
  cycloneName?: string;
  /** Geographic position of the tropical cyclone center. */
  cyclonePosition?: Coordinates;
  /** Cumulonimbus top flight level (e.g. 500 for FL500). */
  cbTopFl?: number;
  /** Cloud top altitude information (TOP FL### or TOP ABV FL###). */
  tops?: SigmetTops;
  /** Radius in nautical miles from the cyclone center (e.g. 180 from "WI 180NM OF CENTER"). */
  withinNm?: number;
  /** Forecast time (UTC) for the phenomenon position. */
  forecastTime?: DayTime;
  /** Forecast geographic position of the phenomenon (tropical cyclone center or volcanic ash cloud). */
  forecastPosition?: Coordinates;
  /** Additional information not captured in other fields (e.g. "+/- 35KTS LLWS"). */
  additionalInfo?: string;
}

/**
 * A parsed SIGMET (Significant Meteorological Information) advisory.
 *
 * This is a discriminated union of the three SIGMET formats. Use the `format`
 * field to narrow the type:
 *
 * ```typescript
 * const sigmet = parseSigmet(raw);
 * if (sigmet.format === 'CONVECTIVE') {
 *   console.log(sigmet.region, sigmet.number);
 * } else if (sigmet.format === 'NONCONVECTIVE') {
 *   console.log(sigmet.seriesName, sigmet.hazards);
 * } else {
 *   console.log(sigmet.firCode, sigmet.phenomena);
 * }
 * ```
 */
export type Sigmet = ConvectiveSigmet | NonConvectiveSigmet | InternationalSigmet;

// ---------------------------------------------------------------------------
// AIRMET types
// ---------------------------------------------------------------------------

/**
 * AIRMET bulletin series identifier. Each series covers a distinct set of
 * weather hazards:
 *
 * - `SIERRA` - IFR conditions and mountain obscuration
 * - `TANGO` - Turbulence, strong surface winds, and low-level wind shear
 * - `ZULU` - Icing and freezing level information
 */
export type AirmetSeries = 'SIERRA' | 'TANGO' | 'ZULU';

/**
 * Maps AIRMET series codes to human-readable descriptions.
 */
export const AIRMET_SERIES_MAP: Record<AirmetSeries, string> = {
  SIERRA: 'IFR and Mountain Obscuration',
  TANGO: 'Turbulence, Strong Surface Winds, and LLWS',
  ZULU: 'Icing and Freezing Level',
};

/**
 * Hazard type for an individual AIRMET advisory area.
 *
 * - `IFR` - Instrument flight rules (ceiling below 1000 ft and/or visibility below 3 SM)
 * - `MTN_OBSCN` - Mountain obscuration by clouds, precipitation, or mist
 * - `TURB` - Moderate turbulence
 * - `STG_SFC_WND` - Sustained surface winds greater than 30 knots
 * - `LLWS` - Low-level wind shear
 * - `ICE` - Moderate icing
 */
export type AirmetHazardType = 'IFR' | 'MTN_OBSCN' | 'TURB' | 'STG_SFC_WND' | 'LLWS' | 'ICE';

/**
 * Maps AIRMET hazard type codes to human-readable descriptions.
 */
export const AIRMET_HAZARD_TYPE_MAP: Record<AirmetHazardType, string> = {
  IFR: 'IFR',
  MTN_OBSCN: 'Mountain Obscuration',
  TURB: 'Turbulence',
  STG_SFC_WND: 'Strong Surface Winds',
  LLWS: 'Low-Level Wind Shear',
  ICE: 'Icing',
};

/**
 * Condition status for an AIRMET hazard area, indicating how the
 * conditions are expected to evolve over the valid period.
 *
 * - `DEVELOPING` - Conditions are expected to develop (DVLPG)
 * - `CONTINUING` - Conditions are continuing beyond the valid period (CONTG BYD)
 * - `ENDING` - Conditions are expected to end (ENDG)
 */
export type AirmetConditionStatus = 'DEVELOPING' | 'CONTINUING' | 'ENDING';

/**
 * Maps AIRMET condition status codes to human-readable descriptions.
 */
export const AIRMET_CONDITION_STATUS_MAP: Record<AirmetConditionStatus, string> = {
  DEVELOPING: 'Developing',
  CONTINUING: 'Continuing',
  ENDING: 'Ending',
};

/**
 * Condition timing information for an AIRMET hazard area.
 * Describes when the hazard conditions are expected to develop, continue, or end.
 */
export interface AirmetConditions {
  /** Status of the conditions (developing, continuing, or ending). */
  status: AirmetConditionStatus;
  /**
   * Start of the condition time window (UTC).
   * For DEVELOPING: the start of the DVLPG window (e.g. 18Z in "DVLPG 18-21Z").
   * For CONTINUING: the time beyond which conditions continue (e.g. 21Z in "CONTG BYD 21Z").
   * For ENDING: the start of the ENDG window (e.g. 02Z in "ENDG 0200-0400Z").
   */
  startTime?: DayTime;
  /**
   * End of the condition time window (UTC).
   * For DEVELOPING: the end of the DVLPG window (e.g. 21Z in "DVLPG 18-21Z").
   * For CONTINUING: the THRU time when given (e.g. 03Z in "CONTG BYD 21Z THRU 03Z").
   * For ENDING: the end of the ENDG window (e.g. 04Z in "ENDG 0200-0400Z"), or
   *   the BY time (e.g. 00Z in "ENDG BY 00Z").
   */
  endTime?: DayTime;
  /**
   * Qualifier for DEVELOPING conditions indicating the conditions develop
   * after a specific time rather than during a range (e.g. "DVLPG AFT 00Z").
   */
  isAfter?: boolean;
}

/**
 * A single freezing level contour line within a FRZLVL section.
 * Represents a line at a specific altitude or a surface freezing level line.
 */
export interface FreezingLevelContour {
  /** Altitude of the freezing level in hundreds of feet (e.g. 040 = 4,000 ft). Undefined when the freezing level is at the surface. */
  altitudeFt?: number;
  /** Raw description of the contour location (e.g. "ALG 40S HNN-50SSE ETX-80SSE BGR-100SSW YSJ"). */
  location: string;
}

/**
 * A multiple freezing level (MULT FRZLVL) boundary within a FRZLVL section.
 * Indicates an area where multiple freezing levels exist below a specified altitude.
 */
export interface FreezingLevelBoundary {
  /** The altitude in feet below which multiple freezing levels exist. */
  belowFt: number;
  /** Area definition points bounding the multiple freezing level region. */
  boundedBy: string[];
}

/**
 * Freezing level information from an AIRMET Zulu bulletin.
 * Describes where the freezing level is located across the advisory area,
 * including altitude ranges, contour lines, and multiple freezing level boundaries.
 */
export interface AirmetFreezingLevel {
  /** Overall freezing level range description (e.g. "RANGING FROM SFC-110 ACRS AREA" or "040-060 ACRS AREA"). */
  range?: string;
  /** Lower bound of the freezing level range in feet. Undefined when the lower bound is at the surface. */
  rangeLowFt?: number;
  /** Upper bound of the freezing level range in feet. */
  rangeHighFt?: number;
  /** Freezing level contour lines at specific altitudes. */
  contours: FreezingLevelContour[];
  /** Multiple freezing level boundaries. */
  multiFrzlvl: FreezingLevelBoundary[];
}

/**
 * An outlook area within an AIRMET Zulu bulletin.
 * Provides a forecast of expected conditions beyond the AIRMET valid period.
 */
export interface AirmetOutlookArea {
  /** Outlook area number (e.g. 1, 2 from "AREA 1...ICE"). */
  areaNumber: number;
  /** The hazard type for this outlook area. */
  hazardType: AirmetHazardType;
  /** Start of the outlook valid period (UTC). */
  validFrom: DayTime;
  /** End of the outlook valid period (UTC). */
  validTo: DayTime;
  /** US state abbreviations and area codes affected. */
  states: string[];
  /** Area definition points bounding the outlook region (BOUNDED BY format). */
  boundedBy: string[];
  /** Description of the hazard conditions (e.g. "MOD ICE BTN 040 AND 170"). */
  conditionDescription?: string;
  /** Altitude range of the hazard, if applicable. */
  altitudeRange?: AltitudeRange;
  /** Condition timing information. */
  conditions?: AirmetConditions;
}

/**
 * A single hazard area within an AIRMET bulletin.
 * Each bulletin may contain multiple hazard areas covering different
 * geographic regions or hazard types.
 */
export interface AirmetHazard {
  /** The type of weather hazard. */
  hazardType: AirmetHazardType;
  /** US state abbreviations and area codes affected by the hazard. */
  states: string[];
  /** True when the affected area includes adjacent coastal waters. */
  coastalWaters: boolean;
  /**
   * Area definition points delineating the affected region.
   * Uses VOR-relative format (e.g. "30NW ALB", "40E PDX") from FROM/TO lines.
   */
  areaPoints: string[];
  /**
   * Area definition points from BOUNDED BY format, used for LLWS POTENTIAL areas.
   * Uses VOR-relative format with dash-separated points.
   */
  boundedBy: string[];
  /** Raw condition description text (e.g. "CIG BLW 010/VIS BLW 3SM BR", "MOD TURB BTN FL250 AND FL380"). */
  conditionDescription?: string;
  /** Altitude range of the hazard (e.g. BTN FL250 AND FL380). */
  altitudeRange?: AltitudeRange;
  /** Cause of the hazard as stated in a DUE TO clause (e.g. "JTST", "LFNT"). */
  cause?: string;
  /** Condition timing information for this hazard area. */
  conditions?: AirmetConditions;
}

/**
 * A parsed AIRMET (Airman's Meteorological Information) bulletin.
 *
 * AIRMETs are in-flight weather advisories for conditions potentially hazardous
 * to all aircraft, particularly light aircraft. They are issued as bulletins
 * containing one or more hazard areas, organized by series:
 *
 * - **Sierra** - IFR and mountain obscuration
 * - **Tango** - Turbulence, strong surface winds, and low-level wind shear
 * - **Zulu** - Icing and freezing level
 *
 * ```typescript
 * import { parseAirmet } from '@squawk/weather';
 *
 * const airmet = parseAirmet(rawBulletin);
 * console.log(airmet.series, airmet.hazards.length);
 * for (const hazard of airmet.hazards) {
 *   console.log(hazard.hazardType, hazard.states, hazard.conditionDescription);
 * }
 * ```
 */
export interface Airmet {
  /** The original raw AIRMET bulletin string as provided to the parser. */
  raw: string;
  /** The AIRMET series (SIERRA, TANGO, or ZULU). */
  series: AirmetSeries;
  /** Update sequence number, if this is an updated issuance (e.g. 2 from "UPDT 2"). */
  updateNumber?: number;
  /** Issuing office identifier from the WMO header (e.g. "BOSS", "SFOT", "CHIT"). */
  issuingOffice?: string;
  /** Time (UTC) the bulletin was issued, from the WMO header. */
  issuedAt?: DayTime;
  /** Time (UTC) until which this AIRMET bulletin is valid. */
  validUntil: DayTime;
  /** The purpose clause from the header (e.g. "IFR AND MTN OBSCN", "TURB AND SFC WND AND LLWS"). */
  purposes: string;
  /** Individual hazard areas within this bulletin. Empty when the bulletin is NIL. */
  hazards: AirmetHazard[];
  /** NIL statements indicating no significant weather expected (e.g. "NO SIGNIFICANT IFR EXP"). */
  nilStatements: string[];
  /** Freezing level information (Zulu bulletins only). */
  freezingLevel?: AirmetFreezingLevel;
  /** Outlook areas with forecast conditions beyond the valid period (Zulu bulletins only). */
  outlooks: AirmetOutlookArea[];
}

// ---------------------------------------------------------------------------
// NOTAM types
// ---------------------------------------------------------------------------

/**
 * NOTAM action type indicating whether this NOTAM creates, replaces,
 * or cancels a notice.
 *
 * - `NEW` - A new NOTAM (NOTAMN)
 * - `REPLACE` - Replaces a previously issued NOTAM (NOTAMR)
 * - `CANCEL` - Cancels a previously issued NOTAM (NOTAMC)
 */
export type NotamAction = 'NEW' | 'REPLACE' | 'CANCEL';

/**
 * Maps NOTAM action codes to human-readable descriptions.
 */
export const NOTAM_ACTION_MAP: Record<NotamAction, string> = {
  NEW: 'New',
  REPLACE: 'Replacement',
  CANCEL: 'Cancellation',
};

/**
 * Traffic type qualifier from the NOTAM Q-line indicating which
 * flight rules the NOTAM applies to.
 *
 * - `IFR` - Applies to IFR traffic only
 * - `VFR` - Applies to VFR traffic only
 * - `IFR_VFR` - Applies to both IFR and VFR traffic
 * - `CHECKLIST` - Checklist NOTAM
 */
export type NotamTrafficType = 'IFR' | 'VFR' | 'IFR_VFR' | 'CHECKLIST';

/**
 * Maps NOTAM traffic type codes to human-readable descriptions.
 */
export const NOTAM_TRAFFIC_TYPE_MAP: Record<NotamTrafficType, string> = {
  IFR: 'IFR',
  VFR: 'VFR',
  IFR_VFR: 'IFR and VFR',
  CHECKLIST: 'Checklist',
};

/**
 * Scope qualifier from the NOTAM Q-line indicating the geographic
 * scope of the notice.
 *
 * - `AERODROME` - Applies to a specific aerodrome (A)
 * - `ENROUTE` - Applies to en route airspace or FIR-level (E)
 * - `NAV_WARNING` - Navigation warning (W)
 * - `AERODROME_ENROUTE` - Applies to both aerodrome and en route (AE)
 * - `AERODROME_WARNING` - Applies to both aerodrome and navigation warning (AW)
 * - `ENROUTE_WARNING` - Applies to both en route and navigation warning (EW)
 * - `AERODROME_ENROUTE_WARNING` - Applies to aerodrome, en route, and navigation warning (AEW)
 */
export type NotamScope =
  | 'AERODROME'
  | 'ENROUTE'
  | 'NAV_WARNING'
  | 'AERODROME_ENROUTE'
  | 'AERODROME_WARNING'
  | 'ENROUTE_WARNING'
  | 'AERODROME_ENROUTE_WARNING';

/**
 * Maps NOTAM scope codes to human-readable descriptions.
 */
export const NOTAM_SCOPE_MAP: Record<NotamScope, string> = {
  AERODROME: 'Aerodrome',
  ENROUTE: 'En Route',
  NAV_WARNING: 'Navigation Warning',
  AERODROME_ENROUTE: 'Aerodrome and En Route',
  AERODROME_WARNING: 'Aerodrome and Navigation Warning',
  ENROUTE_WARNING: 'En Route and Navigation Warning',
  AERODROME_ENROUTE_WARNING: 'Aerodrome, En Route, and Navigation Warning',
};

/**
 * The parsed Q-line (qualifier line) from an ICAO NOTAM.
 * Contains encoded metadata about the NOTAM in a structured 8-field format.
 */
export interface NotamQualifier {
  /** ICAO identifier of the Flight Information Region (e.g. "KZNY", "EGTT"). */
  fir: string;
  /** The full 5-letter NOTAM Q-code (e.g. "QMRLC", "QNALO"). */
  notamCode: string;
  /** Two-letter NOTAM subject code from the Q-code (2nd and 3rd letters, e.g. "MR" for runway, "NA" for approach aids). */
  subjectCode: string;
  /** Two-letter NOTAM condition code from the Q-code (4th and 5th letters, e.g. "LC" for closed, "AS" for active). */
  conditionCode: string;
  /** Traffic type qualifier indicating which flight rules are affected. */
  trafficType: NotamTrafficType;
  /** Purpose codes as a raw string (e.g. "NBO", "BO", "N"). */
  purpose: string;
  /** Geographic scope of the NOTAM. */
  scope: NotamScope;
  /** Lower altitude limit in feet. Undefined when the lower limit is the surface. */
  lowerFt?: number;
  /** Upper altitude limit in feet. 99900 indicates unlimited. */
  upperFt: number;
  /** Center point coordinates of the NOTAM's area of applicability. */
  coordinates: Coordinates;
  /** Radius in nautical miles from the center point. */
  radiusNm: number;
}

/**
 * A date-time reference in a NOTAM effective period.
 * Uses the NOTAM-specific 10-digit format (YYMMDDHHmm) which includes
 * year and month information not present in the standard {@link DayTime}.
 */
export interface NotamDateTime {
  /** Two-digit year (e.g. 24 for 2024, 26 for 2026). */
  year: number;
  /** Month (1-12). */
  month: number;
  /** Day of month (1-31). */
  day: number;
  /** Hour (UTC, 0-23). */
  hour: number;
  /** Minute (UTC, 0-59). */
  minute: number;
}

/**
 * A parsed ICAO-format NOTAM (Notice to Air Missions).
 *
 * NOTAMs provide advance notice of changes to any aeronautical facility,
 * service, procedure, or hazard. This interface represents the structured
 * fields parsed from the standard ICAO NOTAM format including the Q-line,
 * items A through G, and header metadata.
 *
 * ```typescript
 * import { parseNotam } from '@squawk/notams';
 *
 * const notam = parseNotam(rawNotamString);
 * console.log(notam.id);                     // "A1242/24"
 * console.log(notam.action);                 // "NEW"
 * console.log(notam.qualifier?.fir);          // "KZNY"
 * console.log(notam.locationCode);           // "KJFK"
 * console.log(notam.text);                   // "RWY 09L/27R CLSD DUE TO RESURFACING"
 * ```
 */
export interface Notam {
  /** The original raw NOTAM string as provided to the parser. */
  raw: string;
  /** NOTAM series and number identifier (e.g. "A1242/24", "C0156/26"). */
  id: string;
  /** Action type indicating whether this is a new, replacement, or cancellation NOTAM. */
  action: NotamAction;
  /** The NOTAM ID being replaced or cancelled (present when action is REPLACE or CANCEL). */
  referencedId?: string;
  /** Parsed Q-line qualifier data. */
  qualifier?: NotamQualifier;
  /** Item A: Affected location ICAO code(s) (e.g. "KJFK", "KZNY"). Multiple codes are space-separated. */
  locationCode: string;
  /** Item B: Start of the effective period (UTC). */
  effectiveFrom: NotamDateTime;
  /** Item C: End of the effective period (UTC). Undefined when the NOTAM is permanent (PERM) or until further notice (UFN). */
  effectiveUntil?: NotamDateTime;
  /** True when the end time is estimated rather than definite (EST suffix on Item C). */
  isEstimatedEnd: boolean;
  /** True when the NOTAM is permanent with no expiration (PERM in Item C). */
  isPermanent: boolean;
  /** True when the NOTAM is effective until further notice (UFN in Item C). */
  isUntilFurtherNotice: boolean;
  /** Item D: Schedule for intermittent or recurring activity (e.g. "MON-FRI 0700-1600", "H24", "SR-SS"). */
  schedule?: string;
  /** Item E: Free-text description of the NOTAM condition or hazard. */
  text: string;
  /** Item F: Lower altitude limit as a raw string (e.g. "SFC", "FL050", "3000FT"). */
  lowerLimit?: string;
  /** Item G: Upper altitude limit as a raw string (e.g. "UNL", "FL180", "450FT"). */
  upperLimit?: string;
}
