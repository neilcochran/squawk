import type {
  Altimeter,
  CloudCoverage,
  CompassDirection,
  DayTime,
  FlightCategory,
  SkyCondition,
  Visibility,
  WeatherPhenomenon,
  WeatherPhenomenonCode,
  Wind,
} from './shared.js';

/**
 * METAR/SPECI-specific types for aviation weather observation reports.
 */

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
  minVisibilitySm: number;
  /** Maximum visibility in statute miles. */
  maxVisibilitySm: number;
}

/**
 * Variable ceiling range from the METAR remarks section (CIG min V max).
 */
export interface VariableCeiling {
  /** Minimum ceiling in feet AGL (hundreds of feet multiplied by 100). */
  minFtAgl: number;
  /** Maximum ceiling in feet AGL (hundreds of feet multiplied by 100). */
  maxFtAgl: number;
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
  visibilitySm: number;
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
  altitudeFtAgl: number;
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
  visibilitySm: number;
}

/**
 * Visibility observation at a secondary location (e.g. a specific runway).
 */
export interface SecondLocationVisibility {
  /** Discriminant for visibility observations. */
  type: 'VIS';
  /** Visibility in statute miles. */
  visibilitySm: number;
  /** Location identifier (e.g. "RWY11", "RWY06"). */
  location: string;
}

/**
 * Ceiling observation at a secondary location (e.g. a specific runway).
 */
export interface SecondLocationCeiling {
  /** Discriminant for ceiling observations. */
  type: 'CIG';
  /** Ceiling height in feet AGL. */
  ceilingFtAgl: number;
  /** Location identifier (e.g. "RWY11", "RWY06"). */
  location: string;
}

/**
 * Visibility or ceiling observation at a secondary location (e.g. a specific runway).
 * Discriminated on the `type` field.
 */
export type SecondLocationObservation = SecondLocationVisibility | SecondLocationCeiling;

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
  altitudeFtAgl: number;
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
