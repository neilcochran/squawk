/**
 * @packageDocumentation
 * Node entry point. Synchronously reads, decompresses, and parses the
 * bundled `data/airports.json.gz` snapshot at module load time, then
 * exposes the result as a single eager constant. Suitable for server-side
 * Node consumers.
 *
 * Browser and edge consumers should use the {@link "./browser"} entry point
 * instead, which performs the same work asynchronously via `fetch` and
 * `DecompressionStream`.
 */

import type { Airport } from '@squawk/types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Metadata properties attached to the airport dataset describing
 * the FAA NASR data vintage and build provenance.
 */
export interface AirportDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** NASR cycle effective date (e.g. "2026-01-22"). */
  nasrCycleDate: string;
  /** Total number of airport records in the dataset. */
  recordCount: number;
}

/**
 * A pre-processed array of Airport records with attached metadata
 * about the build provenance and NASR cycle.
 */
export interface AirportDataset {
  /** Metadata about the dataset build. */
  properties: AirportDatasetProperties;
  /** Airport records. */
  records: Airport[];
}

/**
 * Internal shape of the bundled JSON file: dataset metadata plus the
 * record array. Matches the wire format produced by the build pipeline.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: AirportDatasetProperties;
  /** Airport records. */
  records: Airport[];
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/airports.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

/**
 * Pre-processed snapshot of airport data derived from the FAA NASR
 * 28-day subscription cycle.
 *
 * Contains airport identification, location, elevation, runways (dimensions,
 * surface, lighting, declared distances), and communication frequencies for
 * every open aviation facility (airports, heliports, seaplane bases, etc.)
 * published by the FAA. Includes selected Canadian, Mexican, Caribbean, and
 * Pacific facilities that participate in US operations; their `state` field
 * is undefined while `country` is populated with a two-letter code.
 *
 * Pass the `records` array directly to `createAirportResolver()` from
 * `@squawk/airports` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledAirports } from '@squawk/airport-data';
 * import { createAirportResolver } from '@squawk/airports';
 *
 * const resolver = createAirportResolver({ data: usBundledAirports.records });
 * ```
 */
export const usBundledAirports: AirportDataset = {
  properties: raw.meta,
  records: raw.records,
};
