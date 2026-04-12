import type {
  Airway,
  AirwayType,
  AirwayRegion,
  AirwayWaypoint,
  AirwayWaypointType,
} from '@squawk/types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Compact representation of an AirwayWaypoint in the bundled JSON format.
 */
interface CompactWaypoint {
  /** Name. */
  nm: string;
  /** Identifier. */
  id?: string;
  /** Waypoint type. */
  wt: AirwayWaypointType;
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
 * Compact representation of an Airway in the bundled JSON format.
 */
interface CompactAirway {
  /** Designation. */
  des: string;
  /** Airway type. */
  tp: AirwayType;
  /** Region. */
  rg: AirwayRegion;
  /** Waypoints. */
  wps: CompactWaypoint[];
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
    /** Total number of airway records. */
    recordCount: number;
    /** Total number of waypoint records. */
    waypointCount: number;
  };
  /** Airway records. */
  records: CompactAirway[];
}

/**
 * Metadata properties attached to the airway dataset describing
 * the FAA NASR data vintage and build provenance.
 */
export interface AirwayDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** NASR cycle effective date (e.g. "2026-01-22"). */
  nasrCycleDate: string;
  /** Total number of airway records in the dataset. */
  recordCount: number;
  /** Total number of waypoint records across all airways. */
  waypointCount: number;
}

/**
 * A pre-processed array of Airway records with attached metadata
 * about the build provenance and NASR cycle.
 */
export interface AirwayDataset {
  /** Metadata about the dataset build. */
  properties: AirwayDatasetProperties;
  /** Airway records. */
  records: Airway[];
}

/**
 * Expands a compact waypoint into the full AirwayWaypoint interface.
 */
function expandWaypoint(c: CompactWaypoint): AirwayWaypoint {
  const wp: AirwayWaypoint = {
    name: c.nm,
    waypointType: c.wt,
    lat: c.lat,
    lon: c.lon,
  };

  if (c.id !== undefined) {
    wp.identifier = c.id;
  }
  if (c.nft !== undefined) {
    wp.navaidFacilityType = c.nft;
  }
  if (c.st !== undefined) {
    wp.state = c.st;
  }
  if (c.icao !== undefined) {
    wp.icaoRegionCode = c.icao;
  }
  if (c.art !== undefined) {
    wp.artccId = c.art;
  }
  if (c.mra !== undefined) {
    wp.minimumReceptionAltitudeFt = c.mra;
  }
  if (c.mea !== undefined) {
    wp.minimumEnrouteAltitudeFt = c.mea;
  }
  if (c.md !== undefined) {
    wp.minimumEnrouteAltitudeDirection = c.md;
  }
  if (c.meao !== undefined) {
    wp.minimumEnrouteAltitudeOppositeFt = c.meao;
  }
  if (c.modo !== undefined) {
    wp.minimumEnrouteAltitudeOppositeDirection = c.modo;
  }
  if (c.maa !== undefined) {
    wp.maximumAuthorizedAltitudeFt = c.maa;
  }
  if (c.moca !== undefined) {
    wp.minimumObstructionClearanceAltitudeFt = c.moca;
  }
  if (c.gmea !== undefined) {
    wp.gnssMinimumEnrouteAltitudeFt = c.gmea;
  }
  if (c.gmd !== undefined) {
    wp.gnssMinimumEnrouteAltitudeDirection = c.gmd;
  }
  if (c.gmeao !== undefined) {
    wp.gnssMinimumEnrouteAltitudeOppositeFt = c.gmeao;
  }
  if (c.gmodo !== undefined) {
    wp.gnssMinimumEnrouteAltitudeOppositeDirection = c.gmodo;
  }
  if (c.mca !== undefined) {
    wp.minimumCrossingAltitudeFt = c.mca;
  }
  if (c.mcad !== undefined) {
    wp.minimumCrossingAltitudeDirection = c.mcad;
  }
  if (c.mcao !== undefined) {
    wp.minimumCrossingAltitudeOppositeFt = c.mcao;
  }
  if (c.mcaod !== undefined) {
    wp.minimumCrossingAltitudeOppositeDirection = c.mcaod;
  }
  if (c.dtn !== undefined) {
    wp.distanceToNextNm = c.dtn;
  }
  if (c.mc !== undefined) {
    wp.magneticCourseDeg = c.mc;
  }
  if (c.mco !== undefined) {
    wp.magneticCourseOppositeDeg = c.mco;
  }
  if (c.cod !== undefined) {
    wp.changeoverDistanceNm = c.cod;
  }
  if (c.sg === true) {
    wp.signalGap = true;
  }
  if (c.us === true) {
    wp.usAirspaceOnly = true;
  }
  if (c.dl === true) {
    wp.dogleg = true;
  }
  if (c.disc === true) {
    wp.discontinued = true;
  }

  return wp;
}

/**
 * Expands a compact airway record into the full Airway interface.
 */
function expandAirway(c: CompactAirway): Airway {
  return {
    designation: c.des,
    type: c.tp,
    region: c.rg,
    waypoints: c.wps.map(expandWaypoint),
  };
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/airways.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

const records: Airway[] = raw.records.map(expandAirway);

/**
 * Pre-processed snapshot of US airway data derived from the FAA NASR
 * 28-day subscription cycle.
 *
 * Contains Victor airways, Jet routes, RNAV Q-routes, RNAV T-routes,
 * colored airways (Green, Red, Amber, Blue), and oceanic routes
 * (Atlantic, Bahama, Pacific, Puerto Rico) with full waypoint sequences,
 * altitude restrictions, and navigation data.
 *
 * Pass the `records` array directly to `createAirwayResolver()` from
 * `@squawk/airways` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledAirways } from '@squawk/airway-data';
 * import { createAirwayResolver } from '@squawk/airways';
 *
 * const resolver = createAirwayResolver({ data: usBundledAirways.records });
 * ```
 */
export const usBundledAirways: AirwayDataset = {
  properties: {
    generatedAt: raw.meta.generatedAt,
    nasrCycleDate: raw.meta.nasrCycleDate,
    recordCount: raw.meta.recordCount,
    waypointCount: raw.meta.waypointCount,
  },
  records,
};
