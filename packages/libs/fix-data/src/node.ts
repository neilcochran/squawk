/**
 * @packageDocumentation
 * Node entry point. Synchronously reads, decompresses, and parses the
 * bundled `data/fixes.json.gz` snapshot at module load time, then exposes
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

import type { Fix } from '@squawk/types';

/**
 * Metadata properties attached to the fix dataset describing
 * the FAA NASR data vintage and build provenance.
 */
export interface FixDatasetProperties {
  /** ISO 8601 timestamp of when the dataset was generated. */
  generatedAt: string;
  /** NASR cycle effective date (e.g. "2026-01-22"). */
  nasrCycleDate: string;
  /** Total number of fix records in the dataset. */
  recordCount: number;
}

/**
 * A pre-processed array of Fix records with attached metadata
 * about the build provenance and NASR cycle.
 */
export interface FixDataset {
  /** Metadata about the dataset build. */
  properties: FixDatasetProperties;
  /** Fix records. */
  records: Fix[];
}

/**
 * Internal shape of the bundled JSON file: dataset metadata plus the
 * record array. Matches the wire format produced by the build pipeline.
 */
interface BundledData {
  /** Dataset metadata. */
  meta: FixDatasetProperties;
  /** Fix records. */
  records: Fix[];
}

const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../data/fixes.json.gz');
const raw: BundledData = JSON.parse(gunzipSync(readFileSync(dataPath)).toString('utf-8'));

/**
 * Pre-processed snapshot of fix/waypoint data derived from the FAA NASR
 * 28-day subscription cycle.
 *
 * Contains fix identification, location, usage category, ARTCC assignment,
 * chart associations, and navaid relationships for every non-CNF named fix
 * and waypoint published by the FAA. Includes selected Canadian, Mexican,
 * Caribbean, and Pacific fixes that participate in US operations; their
 * `state` field is undefined while `country` is populated with a two-letter
 * code and `icaoRegionCode` reflects the foreign region (e.g. `CY` for
 * Canada).
 *
 * Pass the `records` array directly to `createFixResolver()` from
 * `@squawk/fixes` for zero-config lookups:
 *
 * ```typescript
 * import { usBundledFixes } from '@squawk/fix-data';
 * import { createFixResolver } from '@squawk/fixes';
 *
 * const resolver = createFixResolver({ data: usBundledFixes.records });
 * ```
 */
export const usBundledFixes: FixDataset = {
  properties: raw.meta,
  records: raw.records,
};
