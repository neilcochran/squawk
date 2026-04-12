import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Airway, AirwayWaypoint } from '@squawk/types';

/**
 * Compact representation of an AirwayWaypoint. Short keys reduce file size.
 */
interface CompactWaypoint {
  /** Name. */
  nm: string;
  /** Identifier. */
  id?: string;
  /** Waypoint type. */
  wt: string;
  /** Navaid facility type. */
  nft?: string;
  /** State code. */
  st?: string;
  /** ICAO region code. */
  icao?: string;
  /** Latitude. */
  lat: number;
  /** Longitude. */
  lon: number;
  /** ARTCC ID. */
  art?: string;
  /** Minimum reception altitude. */
  mra?: number;
  /** MEA. */
  mea?: number;
  /** MEA direction. */
  md?: string;
  /** MEA opposite. */
  meao?: number;
  /** MEA opposite direction. */
  modo?: string;
  /** MAA. */
  maa?: number;
  /** MOCA. */
  moca?: number;
  /** GNSS MEA. */
  gmea?: number;
  /** GNSS MEA direction. */
  gmd?: string;
  /** GNSS MEA opposite. */
  gmeao?: number;
  /** GNSS MEA opposite direction. */
  gmodo?: string;
  /** MCA. */
  mca?: number;
  /** MCA direction. */
  mcad?: string;
  /** MCA opposite. */
  mcao?: number;
  /** MCA opposite direction. */
  mcaod?: string;
  /** Distance to next NM. */
  dtn?: number;
  /** Magnetic course. */
  mc?: number;
  /** Magnetic course opposite. */
  mco?: number;
  /** Changeover distance. */
  cod?: number;
  /** Signal gap. */
  sg?: true;
  /** US airspace only. */
  us?: true;
  /** Dogleg. */
  dl?: true;
  /** Discontinued. */
  disc?: true;
}

/**
 * Compact representation of an Airway record.
 */
interface CompactAirway {
  /** Designation. */
  des: string;
  /** Airway type. */
  tp: string;
  /** Region. */
  rg: string;
  /** Waypoints. */
  wps: CompactWaypoint[];
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
    /** Total number of airway records in the dataset. */
    recordCount: number;
    /** Total number of waypoint records across all airways. */
    waypointCount: number;
  };
  /** Airway records. */
  records: CompactAirway[];
}

/**
 * Compacts an AirwayWaypoint into its short-key representation.
 */
function compactWaypoint(wp: AirwayWaypoint): CompactWaypoint {
  const c: CompactWaypoint = {
    nm: wp.name,
    wt: wp.waypointType,
    lat: wp.lat,
    lon: wp.lon,
  };

  if (wp.identifier !== undefined) {
    c.id = wp.identifier;
  }
  if (wp.navaidFacilityType !== undefined) {
    c.nft = wp.navaidFacilityType;
  }
  if (wp.state !== undefined) {
    c.st = wp.state;
  }
  if (wp.icaoRegionCode !== undefined) {
    c.icao = wp.icaoRegionCode;
  }
  if (wp.artccId !== undefined) {
    c.art = wp.artccId;
  }
  if (wp.minimumReceptionAltitudeFt !== undefined) {
    c.mra = wp.minimumReceptionAltitudeFt;
  }
  if (wp.minimumEnrouteAltitudeFt !== undefined) {
    c.mea = wp.minimumEnrouteAltitudeFt;
  }
  if (wp.minimumEnrouteAltitudeDirection !== undefined) {
    c.md = wp.minimumEnrouteAltitudeDirection;
  }
  if (wp.minimumEnrouteAltitudeOppositeFt !== undefined) {
    c.meao = wp.minimumEnrouteAltitudeOppositeFt;
  }
  if (wp.minimumEnrouteAltitudeOppositeDirection !== undefined) {
    c.modo = wp.minimumEnrouteAltitudeOppositeDirection;
  }
  if (wp.maximumAuthorizedAltitudeFt !== undefined) {
    c.maa = wp.maximumAuthorizedAltitudeFt;
  }
  if (wp.minimumObstructionClearanceAltitudeFt !== undefined) {
    c.moca = wp.minimumObstructionClearanceAltitudeFt;
  }
  if (wp.gnssMinimumEnrouteAltitudeFt !== undefined) {
    c.gmea = wp.gnssMinimumEnrouteAltitudeFt;
  }
  if (wp.gnssMinimumEnrouteAltitudeDirection !== undefined) {
    c.gmd = wp.gnssMinimumEnrouteAltitudeDirection;
  }
  if (wp.gnssMinimumEnrouteAltitudeOppositeFt !== undefined) {
    c.gmeao = wp.gnssMinimumEnrouteAltitudeOppositeFt;
  }
  if (wp.gnssMinimumEnrouteAltitudeOppositeDirection !== undefined) {
    c.gmodo = wp.gnssMinimumEnrouteAltitudeOppositeDirection;
  }
  if (wp.minimumCrossingAltitudeFt !== undefined) {
    c.mca = wp.minimumCrossingAltitudeFt;
  }
  if (wp.minimumCrossingAltitudeDirection !== undefined) {
    c.mcad = wp.minimumCrossingAltitudeDirection;
  }
  if (wp.minimumCrossingAltitudeOppositeFt !== undefined) {
    c.mcao = wp.minimumCrossingAltitudeOppositeFt;
  }
  if (wp.minimumCrossingAltitudeOppositeDirection !== undefined) {
    c.mcaod = wp.minimumCrossingAltitudeOppositeDirection;
  }
  if (wp.distanceToNextNm !== undefined) {
    c.dtn = wp.distanceToNextNm;
  }
  if (wp.magneticCourseDeg !== undefined) {
    c.mc = wp.magneticCourseDeg;
  }
  if (wp.magneticCourseOppositeDeg !== undefined) {
    c.mco = wp.magneticCourseOppositeDeg;
  }
  if (wp.changeoverDistanceNm !== undefined) {
    c.cod = wp.changeoverDistanceNm;
  }
  if (wp.signalGap) {
    c.sg = true;
  }
  if (wp.usAirspaceOnly) {
    c.us = true;
  }
  if (wp.dogleg) {
    c.dl = true;
  }
  if (wp.discontinued) {
    c.disc = true;
  }

  return c;
}

/**
 * Compacts an Airway into its short-key representation.
 */
function compactAirway(airway: Airway): CompactAirway {
  return {
    des: airway.designation,
    tp: airway.type,
    rg: airway.region,
    wps: airway.waypoints.map(compactWaypoint),
  };
}

/**
 * Writes Airway records to a gzipped compact JSON file at the given path.
 * Creates the output directory if it does not exist.
 *
 * @param airways - Airway records to serialize.
 * @param nasrCycleDate - NASR cycle effective date string.
 * @param outputPath - Absolute path to write the output .json.gz file.
 */
export async function writeOutput(
  airways: Airway[],
  nasrCycleDate: string,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const waypointCount = airways.reduce((sum, a) => sum + a.waypoints.length, 0);

  const output: BundledOutput = {
    meta: {
      generatedAt: new Date().toISOString(),
      nasrCycleDate,
      recordCount: airways.length,
      waypointCount,
    },
    records: airways.map(compactAirway),
  };

  const json = JSON.stringify(output);
  const compressed = gzipSync(Buffer.from(json));
  await writeFile(outputPath, compressed);

  const sizeMb = (compressed.length / 1024 / 1024).toFixed(1);
  console.log(
    `[write-output] Wrote ${output.meta.recordCount} airways (${waypointCount} waypoints) to ${outputPath} (${sizeMb} MB gzipped)`,
  );
}
