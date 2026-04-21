import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AltitudeConstraint,
  ApproachType,
  MissedApproachSequence,
  Procedure,
  ProcedureCommonRoute,
  ProcedureLeg,
  ProcedureLegFixCategory,
  ProcedureLegPathTerminator,
  ProcedureTransition,
  ProcedureType,
  SpeedConstraint,
  TurnDirection,
} from '@squawk/types';

/**
 * Compact representation of an {@link AltitudeConstraint}.
 */
interface CompactAltitudeConstraint {
  /** Descriptor. */
  d: AltitudeConstraint['descriptor'];
  /** Primary altitude in feet. */
  p: number;
  /** Secondary altitude in feet. */
  s?: number;
}

/**
 * Compact representation of a {@link SpeedConstraint}.
 */
interface CompactSpeedConstraint {
  /** Descriptor. */
  d: SpeedConstraint['descriptor'];
  /** Indicated airspeed limit in knots. */
  s: number;
}

/**
 * Compact representation of a {@link ProcedureLeg} using short keys.
 */
interface CompactLeg {
  /** Path terminator. */
  pt: ProcedureLegPathTerminator;
  /** Fix identifier. */
  fi?: string;
  /** Fix category. */
  cat?: ProcedureLegFixCategory;
  /** Latitude in decimal degrees. */
  lat?: number;
  /** Longitude in decimal degrees. */
  lon?: number;
  /** ICAO region code of the termination fix. */
  ir?: string;
  /** Altitude constraint. */
  ac?: CompactAltitudeConstraint;
  /** Speed constraint. */
  sc?: CompactSpeedConstraint;
  /** Course in degrees. */
  crs?: number;
  /** Course is true rather than magnetic. */
  ct?: 1;
  /** Distance in nautical miles. */
  dist?: number;
  /** Hold time in minutes. */
  hold?: number;
  /** Recommended navaid identifier. */
  rn?: string;
  /** Recommended navaid ICAO region code. */
  rnIr?: string;
  /** Theta bearing from recommended navaid in degrees. */
  th?: number;
  /** Rho distance from recommended navaid in nautical miles. */
  rh?: number;
  /** RNP value in nautical miles. */
  rnp?: number;
  /** Commanded turn direction. */
  td?: TurnDirection;
  /** Arc radius in nautical miles. */
  ar?: number;
  /** Center fix identifier. */
  cf?: string;
  /** Center fix ICAO region code. */
  cfIr?: string;
  /** Initial approach fix flag. */
  iaf?: 1;
  /** Intermediate fix flag. */
  ifx?: 1;
  /** Final approach fix flag. */
  faf?: 1;
  /** Final approach course fix flag. */
  facf?: 1;
  /** Missed approach point flag. */
  map?: 1;
  /** Fly-over fix flag. */
  fo?: 1;
}

/**
 * Compact representation of a {@link ProcedureTransition}.
 */
interface CompactTransition {
  /** Transition name. */
  nm: string;
  /** Compact legs. */
  lg: CompactLeg[];
}

/**
 * Compact representation of a {@link ProcedureCommonRoute}.
 */
interface CompactCommonRoute {
  /** Compact legs. */
  lg: CompactLeg[];
  /** Airports served by this route. */
  apt: string[];
  /** Runway identifier when the route is runway-specific. */
  rw?: string;
}

/**
 * Compact representation of a {@link MissedApproachSequence}.
 */
interface CompactMissedApproach {
  /** Compact legs. */
  lg: CompactLeg[];
}

/**
 * Compact representation of a {@link Procedure}.
 */
interface CompactProcedure {
  /** Human-readable procedure name. */
  nm: string;
  /** CIFP procedure identifier. */
  id: string;
  /** Procedure type. */
  tp: ProcedureType;
  /** Airports served by this procedure. */
  apt: string[];
  /** Compact common routes. */
  cr: CompactCommonRoute[];
  /** Compact transitions. */
  tr: CompactTransition[];
  /** Approach classification (IAP only). */
  at?: ApproachType;
  /** Runway served by the approach (IAP only). */
  rw?: string;
  /** Missed approach (IAP only). */
  ma?: CompactMissedApproach;
}

/**
 * Internal shape of the bundled JSON file.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** CIFP cycle effective date in `YYYY-MM-DD`. */
    cifpCycleDate: string;
    /** Total number of procedure records in the dataset. */
    recordCount: number;
    /** Number of SID procedures. */
    sidCount: number;
    /** Number of STAR procedures. */
    starCount: number;
    /** Number of IAP procedures. */
    iapCount: number;
    /** Total leg count across all routes, transitions, and missed approaches. */
    legCount: number;
  };
  /** Compact procedure records. */
  records: CompactProcedure[];
}

/**
 * Metadata properties attached to the procedure dataset describing the
 * FAA CIFP data vintage and build provenance.
 */
export interface ProcedureDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** CIFP cycle effective date in `YYYY-MM-DD` (e.g. "2026-03-25"). */
  cifpCycleDate: string;
  /** Total number of procedure records in the dataset. */
  recordCount: number;
  /** Number of Standard Instrument Departure (SID) procedures. */
  sidCount: number;
  /** Number of Standard Terminal Arrival Route (STAR) procedures. */
  starCount: number;
  /** Number of Instrument Approach Procedure (IAP) procedures. */
  iapCount: number;
  /** Total leg count across all common routes, transitions, and missed approaches. */
  legCount: number;
}

/**
 * A pre-processed array of {@link Procedure} records together with
 * metadata about the build provenance and CIFP cycle.
 */
export interface ProcedureDataset {
  /** Metadata about the dataset build. */
  properties: ProcedureDatasetProperties;
  /** Procedure records. */
  records: Procedure[];
}

/**
 * Expands a compact altitude constraint into the full interface.
 */
function expandAltitudeConstraint(c: CompactAltitudeConstraint): AltitudeConstraint {
  const ac: AltitudeConstraint = {
    descriptor: c.d,
    primaryFt: c.p,
  };
  if (c.s !== undefined) {
    ac.secondaryFt = c.s;
  }
  return ac;
}

/**
 * Expands a compact speed constraint into the full interface.
 */
function expandSpeedConstraint(c: CompactSpeedConstraint): SpeedConstraint {
  return { descriptor: c.d, speedKt: c.s };
}

/**
 * Expands a compact leg into the full {@link ProcedureLeg} interface.
 */
function expandLeg(c: CompactLeg): ProcedureLeg {
  const leg: ProcedureLeg = { pathTerminator: c.pt };
  if (c.fi !== undefined) {
    leg.fixIdentifier = c.fi;
  }
  if (c.cat !== undefined) {
    leg.category = c.cat;
  }
  if (c.lat !== undefined) {
    leg.lat = c.lat;
  }
  if (c.lon !== undefined) {
    leg.lon = c.lon;
  }
  if (c.ir !== undefined) {
    leg.icaoRegionCode = c.ir;
  }
  if (c.ac !== undefined) {
    leg.altitudeConstraint = expandAltitudeConstraint(c.ac);
  }
  if (c.sc !== undefined) {
    leg.speedConstraint = expandSpeedConstraint(c.sc);
  }
  if (c.crs !== undefined) {
    leg.courseDeg = c.crs;
  }
  if (c.ct === 1) {
    leg.courseIsTrue = true;
  }
  if (c.dist !== undefined) {
    leg.distanceNm = c.dist;
  }
  if (c.hold !== undefined) {
    leg.holdTimeMin = c.hold;
  }
  if (c.rn !== undefined) {
    leg.recommendedNavaid = c.rn;
  }
  if (c.rnIr !== undefined) {
    leg.recommendedNavaidIcaoRegionCode = c.rnIr;
  }
  if (c.th !== undefined) {
    leg.thetaDeg = c.th;
  }
  if (c.rh !== undefined) {
    leg.rhoNm = c.rh;
  }
  if (c.rnp !== undefined) {
    leg.rnpNm = c.rnp;
  }
  if (c.td !== undefined) {
    leg.turnDirection = c.td;
  }
  if (c.ar !== undefined) {
    leg.arcRadiusNm = c.ar;
  }
  if (c.cf !== undefined) {
    leg.centerFix = c.cf;
  }
  if (c.cfIr !== undefined) {
    leg.centerFixIcaoRegionCode = c.cfIr;
  }
  if (c.iaf === 1) {
    leg.isInitialApproachFix = true;
  }
  if (c.ifx === 1) {
    leg.isIntermediateFix = true;
  }
  if (c.faf === 1) {
    leg.isFinalApproachFix = true;
  }
  if (c.facf === 1) {
    leg.isFinalApproachCourseFix = true;
  }
  if (c.map === 1) {
    leg.isMissedApproachPoint = true;
  }
  if (c.fo === 1) {
    leg.isFlyover = true;
  }
  return leg;
}

/**
 * Expands a compact transition into the full interface.
 */
function expandTransition(c: CompactTransition): ProcedureTransition {
  return {
    name: c.nm,
    legs: c.lg.map(expandLeg),
  };
}

/**
 * Expands a compact common route into the full interface.
 */
function expandCommonRoute(c: CompactCommonRoute): ProcedureCommonRoute {
  const route: ProcedureCommonRoute = {
    legs: c.lg.map(expandLeg),
    airports: c.apt,
  };
  if (c.rw !== undefined) {
    route.runway = c.rw;
  }
  return route;
}

/**
 * Expands a compact missed approach into the full interface.
 */
function expandMissedApproach(c: CompactMissedApproach): MissedApproachSequence {
  return { legs: c.lg.map(expandLeg) };
}

/**
 * Expands a compact procedure record into the full {@link Procedure}
 * interface, populating IAP-specific fields when present.
 */
function expandProcedure(c: CompactProcedure): Procedure {
  const p: Procedure = {
    name: c.nm,
    identifier: c.id,
    type: c.tp,
    airports: c.apt,
    commonRoutes: c.cr.map(expandCommonRoute),
    transitions: c.tr.map(expandTransition),
  };
  if (c.at !== undefined) {
    p.approachType = c.at;
  }
  if (c.rw !== undefined) {
    p.runway = c.rw;
  }
  if (c.ma !== undefined) {
    p.missedApproach = expandMissedApproach(c.ma);
  }
  return p;
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/procedures.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

const records: Procedure[] = raw.records.map(expandProcedure);

/**
 * Pre-processed snapshot of US instrument procedure data derived from
 * the FAA CIFP (Coded Instrument Flight Procedures) 28-day cycle.
 *
 * Contains Standard Instrument Departures (SIDs), Standard Terminal
 * Arrival Routes (STARs), and Instrument Approach Procedures (IAPs) in
 * the unified ARINC 424 leg model, including path terminators,
 * altitude and speed constraints, recommended navaids, RNP values, and
 * FAF / MAP / IAF / FACF flags.
 *
 * Pass the `records` array directly to `createProcedureResolver()` from
 * `@squawk/procedures` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledProcedures } from '@squawk/procedure-data';
 * import { createProcedureResolver } from '@squawk/procedures';
 *
 * const resolver = createProcedureResolver({ data: usBundledProcedures.records });
 * ```
 */
export const usBundledProcedures: ProcedureDataset = {
  properties: {
    generatedAt: raw.meta.generatedAt,
    cifpCycleDate: raw.meta.cifpCycleDate,
    recordCount: raw.meta.recordCount,
    sidCount: raw.meta.sidCount,
    starCount: raw.meta.starCount,
    iapCount: raw.meta.iapCount,
    legCount: raw.meta.legCount,
  },
  records,
};
