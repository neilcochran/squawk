import { extractAircraftRecords, mapJsonAircraft } from './json-mapping.js';
import { createTracker } from './tracker.js';
import type { AircraftFeed, JsonFeedOptions } from './types/index.js';

/** Default polling interval - matches dump1090-fa's own ~1s refresh cadence. */
const DEFAULT_POLL_INTERVAL_MS = 1000;

/**
 * Creates a live aircraft feed backed by dump1090-fa's `aircraft.json` HTTP
 * endpoint, polled on an interval. Browser-safe (also exported from this
 * package's `/browser` entry) given a same-origin URL or a CORS proxy.
 *
 * ```typescript
 * import { createJsonAircraftFeed } from '@squawk/adsb-feed';
 *
 * const feed = createJsonAircraftFeed({
 *   url: 'http://192.168.1.50:8080/data/aircraft.json',
 * });
 * feed.addEventListener('aircraft:new', (event) => {
 *   console.log((event as CustomEvent).detail.aircraft);
 * });
 * feed.start();
 * ```
 *
 * @param options - Endpoint URL, polling interval, and tracker configuration.
 * @returns An `AircraftFeed` ready to `start()`.
 */
export function createJsonAircraftFeed(options: JsonFeedOptions): AircraftFeed {
  const tracker = createTracker(options);
  const fetchImpl = options.fetch ?? fetch;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  let intervalHandle: ReturnType<typeof setInterval> | undefined;
  let abortController: AbortController | undefined;

  async function poll(): Promise<void> {
    abortController = new AbortController();
    try {
      const response = await fetchImpl(options.url, { signal: abortController.signal });
      if (!response.ok) {
        return;
      }
      const parsed: unknown = await response.json();
      for (const raw of extractAircraftRecords(parsed)) {
        const update = mapJsonAircraft(raw);
        if (update) {
          tracker.ingest(update);
        }
      }
    } catch {
      // Transient network/parse failure, or an in-flight request aborted by
      // stop(). The next poll tick retries - a long-running feed shouldn't
      // die on one bad request.
    }
  }

  return Object.assign(tracker, {
    start(): void {
      if (intervalHandle !== undefined) {
        return;
      }
      intervalHandle = setInterval(() => void poll(), pollIntervalMs);
      void poll();
    },
    stop(): void {
      if (intervalHandle !== undefined) {
        clearInterval(intervalHandle);
        intervalHandle = undefined;
      }
      abortController?.abort();
      tracker.dispose();
    },
  });
}
