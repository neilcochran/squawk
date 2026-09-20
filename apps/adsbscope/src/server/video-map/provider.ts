import type { Coordinates } from '@squawk/types';

import type { ScopeVideoMap } from '../../shared/protocol.js';

import { buildVideoMap } from './build.js';
import type { VideoMapSourceData } from './build.js';
import { loadBundledVideoMapData } from './load-data.js';

/** Default for how many ranges' maps are kept. The UI steps through ten ranges, plus whatever `--range` started at. */
export const DEFAULT_MAX_CACHED_MAPS = 16;

/** Options for {@link createVideoMapProvider}. */
export interface VideoMapProviderOptions {
  /** The receiving station's position: the center of every map. */
  receiver: Coordinates;
  /** Loads the source records. Called at most once. Injectable for tests; defaults to the bundled FAA snapshots. */
  loadData?: () => Promise<VideoMapSourceData>;
  /** How many ranges' maps to keep before the least recently requested is dropped. Defaults to {@link DEFAULT_MAX_CACHED_MAPS}. */
  maxCachedMaps?: number;
}

/** Serves video maps for one receiver. */
export interface VideoMapProvider {
  /** Starts loading the source records, so the first map request does not wait for them. Safe to call more than once. */
  preload(): Promise<void>;
  /**
   * Returns the map for a scope range, building it on first request.
   *
   * @param rangeNm - The scope range in nautical miles.
   * @returns The map.
   */
  get(rangeNm: number): Promise<ScopeVideoMap>;
}

/**
 * Creates the source of video maps for one receiver. The source records are
 * loaded once, on first use, and each range's map is built once and kept. A
 * failed load is not remembered, so the next request tries again.
 *
 * The cache is bounded: the range comes from a request, so without a bound
 * anyone who can reach the server could grow it without limit by asking for
 * ever-different ranges. The least recently requested map is dropped first.
 *
 * @param options - The receiver position, and injectable loading and cache size.
 * @returns The provider.
 */
export function createVideoMapProvider(options: VideoMapProviderOptions): VideoMapProvider {
  const loadData = options.loadData ?? loadBundledVideoMapData;
  const maxCachedMaps = options.maxCachedMaps ?? DEFAULT_MAX_CACHED_MAPS;
  const mapsByRange = new Map<number, ScopeVideoMap>();
  let dataPromise: Promise<VideoMapSourceData> | undefined;

  function load(): Promise<VideoMapSourceData> {
    dataPromise ??= loadData().catch((error: unknown) => {
      dataPromise = undefined;
      throw error;
    });
    return dataPromise;
  }

  return {
    async preload(): Promise<void> {
      await load();
    },
    async get(rangeNm: number): Promise<ScopeVideoMap> {
      const cached = mapsByRange.get(rangeNm);
      if (cached !== undefined) {
        mapsByRange.delete(rangeNm);
        mapsByRange.set(rangeNm, cached);
        return cached;
      }
      const map = buildVideoMap(await load(), options.receiver, rangeNm);
      mapsByRange.set(rangeNm, map);
      for (const oldestRange of mapsByRange.keys()) {
        if (mapsByRange.size <= maxCachedMaps) {
          break;
        }
        mapsByRange.delete(oldestRange);
      }
      return map;
    },
  };
}
