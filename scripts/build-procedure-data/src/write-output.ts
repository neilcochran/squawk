import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import type {
  Procedure,
  ProcedureWaypoint,
  ProcedureWaypointCategory,
  ProcedureWaypointTypeCode,
  ProcedureType,
  ProcedureTransition,
  ProcedureCommonRoute,
} from '@squawk/types';

/**
 * Compact representation of a ProcedureWaypoint. Short keys reduce file size.
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
 * Compact representation of a Procedure record.
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
 * Shape of the bundled JSON output file.
 */
interface BundledOutput {
  /** Dataset metadata. */
  meta: {
    /** ISO 8601 timestamp of when the dataset was generated. */
    generatedAt: string;
    /** NASR cycle effective date. */
    nasrCycleDate: string;
    /** Total number of procedure records in the dataset. */
    recordCount: number;
    /** Number of SID procedures. */
    sidCount: number;
    /** Number of STAR procedures. */
    starCount: number;
    /** Total number of waypoint records across all procedures. */
    waypointCount: number;
  };
  /** Procedure records. */
  records: CompactProcedure[];
}

/**
 * Compacts a ProcedureWaypoint into its short-key representation.
 */
function compactWaypoint(wp: ProcedureWaypoint): CompactWaypoint {
  const c: CompactWaypoint = {
    fi: wp.fixIdentifier,
    cat: wp.category,
    tc: wp.typeCode,
    lat: wp.lat,
    lon: wp.lon,
  };

  if (wp.icaoRegionCode !== undefined) {
    c.icao = wp.icaoRegionCode;
  }

  return c;
}

/**
 * Compacts a ProcedureTransition into its short-key representation.
 */
function compactTransition(t: ProcedureTransition): CompactTransition {
  return {
    nm: t.name,
    wps: t.waypoints.map(compactWaypoint),
  };
}

/**
 * Compacts a ProcedureCommonRoute into its short-key representation.
 */
function compactCommonRoute(r: ProcedureCommonRoute): CompactCommonRoute {
  return {
    wps: r.waypoints.map(compactWaypoint),
    apt: r.airports,
  };
}

/**
 * Compacts a Procedure into its short-key representation.
 */
function compactProcedure(p: Procedure): CompactProcedure {
  return {
    nm: p.name,
    cc: p.computerCode,
    tp: p.type,
    apt: p.airports,
    cr: p.commonRoutes.map(compactCommonRoute),
    tr: p.transitions.map(compactTransition),
  };
}

/**
 * Counts total waypoints across all common routes and transitions of a procedure.
 */
function countWaypoints(p: Procedure): number {
  let count = 0;
  for (const route of p.commonRoutes) {
    count += route.waypoints.length;
  }
  for (const transition of p.transitions) {
    count += transition.waypoints.length;
  }
  return count;
}

/**
 * Writes Procedure records to a gzipped compact JSON file at the given path.
 * Creates the output directory if it does not exist.
 *
 * @param procedures - Procedure records to serialize.
 * @param nasrCycleDate - NASR cycle effective date string.
 * @param outputPath - Absolute path to write the output .json.gz file.
 */
export async function writeOutput(
  procedures: Procedure[],
  nasrCycleDate: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const waypointCount = procedures.reduce((sum, p) => sum + countWaypoints(p), 0);
  const sidCount = procedures.filter((p) => p.type === 'SID').length;
  const starCount = procedures.filter((p) => p.type === 'STAR').length;

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      nasrCycleDate,
      recordCount: procedures.length,
      sidCount,
      starCount,
      waypointCount,
    },
    records: procedures.map(compactProcedure),
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} procedures ` +
      `(${sidCount} SIDs, ${starCount} STARs, ${waypointCount} waypoints) ` +
      `to ${outputPath} (${sizeMb} MB gzipped)`,
  );

  const readmePath = resolve(dirname(outputPath), '..', 'README.md');
  await updateReadmeDate(readmePath, nasrCycleDate);
}

/**
 * Updates the bolded date in the "Data source" section of a README to match
 * the cycle date of the data that was just built.
 */
async function updateReadmeDate(readmePath: string, date: string): Promise<void> {
  const readme = await readFile(readmePath, 'utf-8');
  const updated = readme.replace(
    /The bundled snapshot is built from the \*\*\d{4}-\d{2}-\d{2}\*\*/,
    `The bundled snapshot is built from the **${date}**`,
  );
  if (updated !== readme) {
    await writeFile(readmePath, updated, 'utf-8');
    console.log(`[write-output] Updated README date to ${date}`);
  }
}
