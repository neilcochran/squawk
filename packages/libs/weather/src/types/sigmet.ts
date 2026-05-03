import type { Coordinates } from '@squawk/types';

import type { AltitudeRange, CompassDirection, DayTime } from './shared.js';

/**
 * SIGMET-specific types for Significant Meteorological Information advisories.
 */

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
  speedKmPerHr?: number;
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
  visibilityBelowSm?: number;
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
