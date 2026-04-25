/**
 * @packageDocumentation
 * Browser / edge entry point. Asynchronously fetches, decompresses, and
 * parses the bundled `data/fixes.json.gz` snapshot using Web Streams
 * (`DecompressionStream`) and the global `fetch`. Works in every evergreen
 * browser, Cloudflare Workers, Deno Deploy, and Node 22+.
 *
 * Node consumers should use the default {@link "."} entry point instead,
 * which performs the same work synchronously at module load time.
 */

import type { Fix } from '@squawk/types';
import type { FixDataset, FixDatasetProperties } from './node.js';

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

/**
 * Options for {@link loadUsBundledFixes}.
 */
export interface LoadFixDatasetOptions {
  /**
   * URL of the gzipped dataset file. Defaults to a path resolved relative to
   * this module's `import.meta.url`, which works under any modern ESM bundler
   * when the package is installed normally. Override this to host the file
   * on your own CDN or to provide a custom test fixture.
   */
  url?: string | URL;
  /**
   * Custom fetch implementation. Defaults to the global `fetch`. Useful for
   * tests, edge runtimes that need a configured fetcher, or environments
   * with a non-standard fetch.
   */
  fetch?: typeof globalThis.fetch;
}

/**
 * Asynchronously loads, decompresses, and parses the bundled fix
 * dataset. Returns the same `FixDataset` shape as the Node entry point
 * exports as `usBundledFixes`.
 *
 * Handles servers that advertise transport-level gzip via
 * `Content-Encoding: gzip` (in which case `fetch()` decodes the body
 * automatically) as well as servers that serve the `.gz` as opaque bytes.
 *
 * ```typescript
 * import { loadUsBundledFixes } from '@squawk/fix-data/browser';
 * import { createFixResolver } from '@squawk/fixes';
 *
 * const dataset = await loadUsBundledFixes();
 * const resolver = createFixResolver({ data: dataset.records });
 * ```
 *
 * To host the asset on your own CDN or to override the URL for any other
 * reason, pass an explicit `url`:
 *
 * ```typescript
 * const dataset = await loadUsBundledFixes({
 *   url: 'https://your-cdn.example/fixes.json.gz',
 * });
 * ```
 */
export async function loadUsBundledFixes(options?: LoadFixDatasetOptions): Promise<FixDataset> {
  const url = options?.url ?? new URL('../data/fixes.json.gz', import.meta.url);
  const fetchImpl = options?.fetch ?? globalThis.fetch;

  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch fix dataset from ${String(url)}: ${res.status} ${res.statusText}`,
    );
  }
  if (res.body === null) {
    throw new Error(`Response body is null for ${String(url)}`);
  }

  const transportEncoded =
    res.headers.get('content-encoding')?.toLowerCase().includes('gzip') ?? false;
  const stream = transportEncoded
    ? res.body
    : res.body.pipeThrough(new DecompressionStream('gzip'));

  const text = await new Response(stream).text();
  const raw: BundledData = JSON.parse(text);

  return {
    properties: raw.meta,
    records: raw.records,
  };
}
