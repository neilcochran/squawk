import type { AltitudeRange, DayTime } from './shared.js';

/**
 * AIRMET-specific types for Airman's Meteorological Information bulletins.
 */

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
