import type { Coordinates } from '@squawk/types';
import type { CloudCoverage, DayTime, Visibility, WeatherPhenomenon } from './shared.js';

/**
 * PIREP-specific types for Pilot Report parsing.
 */

/**
 * The type of pilot report.
 *
 * - `UA` - Routine pilot report
 * - `UUA` - Urgent pilot report (severe turbulence, severe icing, or other hazardous conditions)
 */
export type PirepType = 'UA' | 'UUA';

/**
 * A PIREP location reference consisting of a navaid or airport identifier,
 * optionally qualified by a magnetic radial and distance in nautical miles.
 */
export interface PirepLocationPoint {
  /** Navaid or airport identifier (e.g. "OKC", "KOKC", "SAV"). */
  identifier: string;
  /** Three-digit magnetic radial from the station in degrees (0-360). */
  radialDeg?: number;
  /** Distance from the station in nautical miles. */
  distanceNm?: number;
}

/**
 * Discriminated union covering all PIREP location variants from the /OV field.
 *
 * - `station` - A single point reference (station only, or station with radial/distance)
 * - `route` - A route between two or more points, each of which may include radial/distance
 * - `latlon` - A latitude/longitude position for overwater PIREPs
 */
export type PirepLocation = PirepLocationStation | PirepLocationRoute | PirepLocationLatLon;

/**
 * A single station location reference (e.g. "OKC" or "SAV 180020").
 */
export interface PirepLocationStation {
  /** Discriminator for the location type. */
  locationType: 'station';
  /** The station point reference. */
  point: PirepLocationPoint;
}

/**
 * A route between two or more location points (e.g. "DHT 360015-AMA-CDS").
 */
export interface PirepLocationRoute {
  /** Discriminator for the location type. */
  locationType: 'route';
  /** The ordered sequence of points along the route. */
  points: PirepLocationPoint[];
}

/**
 * A latitude/longitude position for overwater PIREPs (e.g. "3412N11830W").
 */
export interface PirepLocationLatLon {
  /** Discriminator for the location type. */
  locationType: 'latlon';
  /** The geographic coordinates. */
  coordinates: Coordinates;
}

/**
 * A single cloud layer as reported in a PIREP sky condition (/SK) field.
 * Unlike METAR cloud layers, PIREP sky conditions report altitudes in feet MSL
 * (not AGL), and bases or tops may be unknown.
 */
export interface PirepCloudLayer {
  /** Cloud coverage amount, or 'CLR' for clear skies. */
  coverage: CloudCoverage | 'CLR';
  /** Cloud base altitude in feet MSL. Omitted when unknown (UNKN). */
  baseFtMsl?: number;
  /** Cloud top altitude in feet MSL. Omitted when unknown (UNKN). */
  topFtMsl?: number;
}

/**
 * Turbulence intensity as reported in PIREP /TB field.
 *
 * - `NEG` - Negative (none)
 * - `LGT` - Light
 * - `MOD` - Moderate
 * - `SEV` - Severe
 * - `EXTRM` - Extreme
 */
export type PirepTurbulenceIntensity = 'NEG' | 'LGT' | 'MOD' | 'SEV' | 'EXTRM';

/**
 * Maps PIREP turbulence intensity codes to human-readable descriptions.
 */
export const PIREP_TURBULENCE_INTENSITY_MAP: Record<PirepTurbulenceIntensity, string> = {
  NEG: 'Negative',
  LGT: 'Light',
  MOD: 'Moderate',
  SEV: 'Severe',
  EXTRM: 'Extreme',
};

/**
 * Type of turbulence as reported in PIREP /TB field.
 *
 * - `CAT` - Clear Air Turbulence
 * - `CHOP` - Chop
 * - `LLWS` - Low Level Wind Shear
 */
export type TurbulenceType = 'CAT' | 'CHOP' | 'LLWS';

/**
 * Maps turbulence type codes to human-readable descriptions.
 */
export const TURBULENCE_TYPE_MAP: Record<TurbulenceType, string> = {
  CAT: 'Clear Air Turbulence',
  CHOP: 'Chop',
  LLWS: 'Low Level Wind Shear',
};

/**
 * Frequency of turbulence as reported in PIREP /TB field.
 *
 * - `OCC` - Occasional (less than 1/3 of the time)
 * - `INT` - Intermittent (1/3 to 2/3 of the time)
 * - `CONT` - Continuous (more than 2/3 of the time)
 */
export type TurbulenceFrequency = 'OCC' | 'INT' | 'CONT';

/**
 * Maps turbulence frequency codes to human-readable descriptions.
 */
export const TURBULENCE_FREQUENCY_MAP: Record<TurbulenceFrequency, string> = {
  OCC: 'Occasional',
  INT: 'Intermittent',
  CONT: 'Continuous',
};

/**
 * A parsed turbulence report from the PIREP /TB field.
 */
export interface PirepTurbulence {
  /** Turbulence intensity (lower bound when a range is reported). */
  intensity: PirepTurbulenceIntensity;
  /** Upper bound of intensity range (e.g. SEV in "MOD-SEV"). Omitted for single intensities. */
  intensityHigh?: PirepTurbulenceIntensity;
  /** Type of turbulence, if reported. */
  type?: TurbulenceType;
  /** Frequency of turbulence, if reported. */
  frequency?: TurbulenceFrequency;
  /** Base altitude of the turbulence layer in feet MSL. */
  baseFtMsl?: number;
  /** Top altitude of the turbulence layer in feet MSL. */
  topFtMsl?: number;
  /** True when turbulence is reported below a specified altitude (BLO modifier). */
  belowAltitude?: number;
  /** True when turbulence is reported above a specified altitude (ABV modifier). */
  aboveAltitude?: number;
}

/**
 * Icing intensity as reported in PIREP /IC field.
 *
 * - `NEG` - Negative (none)
 * - `TR` - Trace
 * - `LGT` - Light
 * - `MOD` - Moderate
 * - `SEV` - Severe
 */
export type PirepIcingIntensity = 'NEG' | 'TR' | 'LGT' | 'MOD' | 'SEV';

/**
 * Maps PIREP icing intensity codes to human-readable descriptions.
 */
export const PIREP_ICING_INTENSITY_MAP: Record<PirepIcingIntensity, string> = {
  NEG: 'Negative',
  TR: 'Trace',
  LGT: 'Light',
  MOD: 'Moderate',
  SEV: 'Severe',
};

/**
 * Type of icing as reported in PIREP /IC field.
 *
 * - `RIME` - Rime icing
 * - `CLR` - Clear icing
 * - `MXD` - Mixed icing
 * - `SLD` - Supercooled large droplets
 */
export type IcingType = 'RIME' | 'CLR' | 'MXD' | 'SLD';

/**
 * Maps icing type codes to human-readable descriptions.
 */
export const ICING_TYPE_MAP: Record<IcingType, string> = {
  RIME: 'Rime',
  CLR: 'Clear',
  MXD: 'Mixed',
  SLD: 'Supercooled Large Droplets',
};

/**
 * A parsed icing report from the PIREP /IC field.
 */
export interface PirepIcing {
  /** Icing intensity (lower bound when a range is reported). */
  intensity: PirepIcingIntensity;
  /** Upper bound of intensity range (e.g. MOD in "LGT-MOD"). Omitted for single intensities. */
  intensityHigh?: PirepIcingIntensity;
  /** Type of icing, if reported. */
  type?: IcingType;
  /** Base altitude of the icing layer in feet MSL. */
  baseFtMsl?: number;
  /** Top altitude of the icing layer in feet MSL. */
  topFtMsl?: number;
}

/**
 * Wind as reported in the PIREP /WV field.
 * Unlike METAR winds which report direction in degrees true, PIREP winds
 * report direction in degrees magnetic.
 */
export interface PirepWind {
  /** Wind direction in degrees magnetic (0-360). */
  directionDegMagnetic: number;
  /** Wind speed in knots. */
  speedKt: number;
}

/**
 * A parsed Pilot Report (PIREP).
 *
 * PIREPs are filed by pilots to report weather conditions encountered in flight.
 * They use a slash-delimited field format with standardized field markers
 * (e.g. /OV, /TM, /FL, /TP, /SK, /WX, /TA, /WV, /TB, /IC, /RM).
 *
 * ```typescript
 * import { parsePirep } from '@squawk/weather';
 *
 * const pirep = parsePirep('UA /OV OKC 063015/TM 1522/FL085/TP C172/SK BKN065-TOP090/TB LGT/RM SMOOTH');
 * console.log(pirep.type);              // "UA"
 * console.log(pirep.location);          // { locationType: 'station', point: { identifier: 'OKC', radialDeg: 63, distanceNm: 15 } }
 * console.log(pirep.altitudeFtMsl);     // 8500
 * console.log(pirep.aircraftType);      // "C172"
 * ```
 */
export interface Pirep {
  /** The original raw PIREP string as provided to the parser. */
  raw: string;
  /** Type of pilot report (routine or urgent). */
  type: PirepType;
  /** Location of the observation (from /OV field). */
  location?: PirepLocation;
  /** Time of the observation in UTC (from /TM field). */
  time?: DayTime;
  /** Flight level or altitude in feet MSL (from /FL field). FL085 = 8500 ft. */
  altitudeFtMsl?: number;
  /**
   * Qualifier for special altitude values in the /FL field.
   * - `UNKN` - altitude unknown
   * - `DURD` - during descent
   * - `DURC` - during climb
   */
  altitudeQualifier?: 'UNKN' | 'DURD' | 'DURC';
  /** ICAO aircraft type designator (from /TP field, e.g. "C172", "B738"). */
  aircraftType?: string;
  /** Sky condition cloud layers (from /SK field). */
  skyCondition?: PirepCloudLayer[];
  /** Flight visibility (from /WX field). */
  visibility?: Visibility;
  /** Weather phenomena observed (from /WX field). */
  weatherPhenomena?: WeatherPhenomenon[];
  /** Outside air temperature in degrees Celsius (from /TA field). */
  temperatureC?: number;
  /** Wind direction and speed (from /WV field, direction is magnetic). */
  wind?: PirepWind;
  /** Turbulence reports, one per layer (from /TB field). */
  turbulence?: PirepTurbulence[];
  /** Icing reports, one per layer (from /IC field). */
  icing?: PirepIcing[];
  /** Free-text remarks (from /RM field). */
  remarks?: string;
}
