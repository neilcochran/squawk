/**
 * @packageDocumentation
 * Node entry point. Synchronously reads, decompresses, and parses the
 * bundled `data/airways.json.gz` snapshot at module load time, then exposes
 * the result as a single eager constant. Suitable for server-side Node
 * consumers.
 *
 * Browser and edge consumers should use the {@link "./browser"} entry point
 * instead, which performs the same work asynchronously via `fetch` and
 * `DecompressionStream`.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import type { Airway } from '@squawk/types';

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
 * Internal shape of the bundled JSON file: dataset metadata plus the
 * record array. Matches the wire format produced by the build pipeline.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: AirwayDatasetProperties;
  /** Airway records. */
  records: Airway[];
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/airways.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

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
  properties: raw.meta,
  records: raw.records,
};
