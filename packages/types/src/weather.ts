// ---------------------------------------------------------------------------
// Shared weather types - reused by METAR, TAF, and other weather formats
// ---------------------------------------------------------------------------

/**
 * Standard 8-point compass direction used in METAR sector visibility
 * and other directional observations.
 */
export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

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
  /** Hour (UTC) when the peak wind occurred. Always populated on a parsed Metar result (backfilled from observation time when omitted in the raw report). */
  hour?: number;
  /** Minute (UTC) when the peak wind occurred. */
  minute: number;
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
  /** Minute (UTC) when the wind shift occurred. */
  minute: number;
  /** Hour (UTC) when the wind shift occurred. Always populated on a parsed Metar result (backfilled from observation time when omitted in the raw report). */
  hour?: number;
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
  /** Minute (UTC) of the event. */
  minute: number;
  /** Hour (UTC) of the event. Always populated on a parsed Metar result (backfilled from observation time when omitted in the raw report). */
  hour?: number;
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
  /** Day of month (UTC) when the observation was taken (1-31). */
  dayOfMonth: number;
  /** Hour (UTC) when the observation was taken (0-23). */
  hour: number;
  /** Minute (UTC) when the observation was taken (0-59). */
  minute: number;
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
  /** Start day of month (UTC) for this group's validity period. */
  startDay?: number;
  /** Start hour (UTC) for this group's validity period. */
  startHour?: number;
  /** Start minute (UTC) for FM groups (always present on FM, absent on TEMPO/BECMG). */
  startMinute?: number;
  /** End day of month (UTC) for this group's validity period (TEMPO/BECMG/PROB only). */
  endDay?: number;
  /** End hour (UTC) for this group's validity period (TEMPO/BECMG/PROB only). */
  endHour?: number;
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
  /** Day of month (UTC) when the forecast was issued (1-31). */
  issuedDay: number;
  /** Hour (UTC) when the forecast was issued (0-23). */
  issuedHour: number;
  /** Minute (UTC) when the forecast was issued (0-59). */
  issuedMinute: number;
  /** True when the TAF is an amendment to a previously issued forecast (AMD). */
  isAmended: boolean;
  /** True when the TAF is a correction to a previously issued forecast (COR). */
  isCorrected: boolean;
  /** True when the TAF has been cancelled (CNL). */
  isCancelled: boolean;
  /** Start day of month (UTC) of the overall forecast validity period. */
  validFromDay: number;
  /** Start hour (UTC) of the overall forecast validity period. */
  validFromHour: number;
  /** End day of month (UTC) of the overall forecast validity period. */
  validToDay: number;
  /** End hour (UTC) of the overall forecast validity period. */
  validToHour: number;
  /** Forecast groups. The first element is always the base forecast (no changeType). Empty when cancelled. */
  forecast: TafForecastGroup[];
}
