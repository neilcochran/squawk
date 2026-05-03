/**
 * @packageDocumentation
 * Node entry point. Synchronously reads, decompresses, and parses the
 * bundled `data/navaids.json.gz` snapshot at module load time, then
 * exposes the result as a single eager constant. Suitable for server-side
 * Node consumers.
 *
 * Browser and edge consumers should use the {@link "./browser"} entry point
 * instead, which performs the same work asynchronously via `fetch` and
 * `DecompressionStream`.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import type { Navaid } from '@squawk/types';

/**
 * Metadata properties attached to the navaid dataset describing
 * the FAA NASR data vintage and build provenance.
 */
export interface NavaidDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** NASR cycle effective date (e.g. "2026-01-22"). */
  nasrCycleDate: string;
  /** Total number of navaid records in the dataset. */
  recordCount: number;
}

/**
 * A pre-processed array of Navaid records with attached metadata
 * about the build provenance and NASR cycle.
 */
export interface NavaidDataset {
  /** Metadata about the dataset build. */
  properties: NavaidDatasetProperties;
  /** Navaid records. */
  records: Navaid[];
}

/**
 * Internal shape of the bundled JSON file: dataset metadata plus the
 * record array. Matches the wire format produced by the build pipeline.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: NavaidDatasetProperties;
  /** Navaid records. */
  records: Navaid[];
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/navaids.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

/**
 * Pre-processed snapshot of navaid data derived from the FAA NASR
 * 28-day subscription cycle.
 *
 * Contains navaid identification, location, frequency, type, and service
 * volume information for every non-shutdown navigational aid (VORs, VORTACs,
 * VOR/DMEs, TACANs, DMEs, NDBs, NDB/DMEs, fan markers, and VOTs) published
 * by the FAA. Includes selected Canadian, Mexican, and Caribbean navaids
 * that participate in US operations; their `state` field is undefined while
 * `country` is populated with a two-letter code.
 *
 * Pass the `records` array directly to `createNavaidResolver()` from
 * `@squawk/navaids` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledNavaids } from '@squawk/navaid-data';
 * import { createNavaidResolver } from '@squawk/navaids';
 *
 * const resolver = createNavaidResolver({ data: usBundledNavaids.records });
 * ```
 */
export const usBundledNavaids: NavaidDataset = {
  properties: raw.meta,
  records: raw.records,
};
