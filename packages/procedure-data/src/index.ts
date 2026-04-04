import type {
  Procedure,
  ProcedureType,
  ProcedureWaypoint,
  ProcedureWaypointCategory,
  ProcedureWaypointTypeCode,
  ProcedureTransition,
  ProcedureCommonRoute,
} from '@squawk/types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Compact representation of a ProcedureWaypoint in the bundled JSON format.
 */
interface CompactWaypoint {
  /** Fix identifier. */
  fi: string;
  /** Category. */
  cat: ProcedureWaypointCategory;
  /** Type code. */
  tc: ProcedureWaypointTypeCode;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lon: number;
  /** ICAO region code. */
  icao?: string;
}

/**
 * Compact representation of a ProcedureTransition.
 */
interface CompactTransition {
  /** Transition name. */
  nm: string;
  /** Waypoints. */
  wps: CompactWaypoint[];
}

/**
 * Compact representation of a ProcedureCommonRoute.
 */
interface CompactCommonRoute {
  /** Waypoints. */
  wps: CompactWaypoint[];
  /** Adapted airports. */
  apt: string[];
}

/**
 * Compact representation of a Procedure in the bundled JSON format.
 */
interface CompactProcedure {
  /** Procedure name. */
  nm: string;
  /** Computer code. */
  cc: string;
  /** Procedure type. */
  tp: ProcedureType;
  /** Adapted airports. */
  apt: string[];
  /** Common routes. */
  cr: CompactCommonRoute[];
  /** Transitions. */
  tr: CompactTransition[];
}

/**
 * Shape of the bundled JSON data file.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** NASR cycle effective date. */
    nasrCycleDate: string;
    /** Total number of procedure records. */
    recordCount: number;
    /** Number of SID procedures. */
    sidCount: number;
    /** Number of STAR procedures. */
    starCount: number;
    /** Total number of waypoint records. */
    waypointCount: number;
  };
  /** Procedure records. */
  records: CompactProcedure[];
}

/**
 * Metadata properties attached to the procedure dataset describing
 * the FAA NASR data vintage and build provenance.
 */
export interface ProcedureDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** NASR cycle effective date (e.g. "2026-01-22"). */
  nasrCycleDate: string;
  /** Total number of procedure records in the dataset. */
  recordCount: number;
  /** Number of SID procedures. */
  sidCount: number;
  /** Number of STAR procedures. */
  starCount: number;
  /** Total number of waypoint records across all procedures. */
  waypointCount: number;
}

/**
 * A pre-processed array of Procedure records with attached metadata
 * about the build provenance and NASR cycle.
 */
export interface ProcedureDataset {
  /** Metadata about the dataset build. */
  properties: ProcedureDatasetProperties;
  /** Procedure records. */
  records: Procedure[];
}

/**
 * Expands a compact waypoint into the full ProcedureWaypoint interface.
 */
function expandWaypoint(c: CompactWaypoint): ProcedureWaypoint {
  const wp: ProcedureWaypoint = {
    fixIdentifier: c.fi,
    category: c.cat,
    typeCode: c.tc,
    lat: c.lat,
    lon: c.lon,
  };

  if (c.icao !== undefined) {
    wp.icaoRegionCode = c.icao;
  }

  return wp;
}

/**
 * Expands a compact transition into the full ProcedureTransition interface.
 */
function expandTransition(c: CompactTransition): ProcedureTransition {
  return {
    name: c.nm,
    waypoints: c.wps.map(expandWaypoint),
  };
}

/**
 * Expands a compact common route into the full ProcedureCommonRoute interface.
 */
function expandCommonRoute(c: CompactCommonRoute): ProcedureCommonRoute {
  return {
    waypoints: c.wps.map(expandWaypoint),
    airports: c.apt,
  };
}

/**
 * Expands a compact procedure record into the full Procedure interface.
 */
function expandProcedure(c: CompactProcedure): Procedure {
  return {
    name: c.nm,
    computerCode: c.cc,
    type: c.tp,
    airports: c.apt,
    commonRoutes: c.cr.map(expandCommonRoute),
    transitions: c.tr.map(expandTransition),
  };
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/procedures.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

const records: Procedure[] = raw.records.map(expandProcedure);

/**
 * Pre-processed snapshot of US instrument procedure data derived from the
 * FAA NASR 28-day subscription cycle.
 *
 * Contains Standard Instrument Departures (SIDs) and Standard Terminal
 * Arrival Routes (STARs) with full waypoint sequences, named transitions,
 * and adapted airport associations.
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
    nasrCycleDate: raw.meta.nasrCycleDate,
    recordCount: raw.meta.recordCount,
    sidCount: raw.meta.sidCount,
    starCount: raw.meta.starCount,
    waypointCount: raw.meta.waypointCount,
  },
  records,
};
