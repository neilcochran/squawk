import { createBeastAircraftFeed } from './beast-source.js';
import { DEFAULT_PORT_BY_SOURCE } from './default-ports.js';
import { createJsonAircraftFeed } from './json-source.js';
import { createSbsAircraftFeed } from './sbs-source.js';
import type { AircraftFeed, AircraftFeedOptions, SourceFeedOptions } from './types/index.js';

/**
 * Assembles dump1090-fa's standard `aircraft.json` URL from a host and port.
 * An IPv6 literal host is bracketed so the port separator stays unambiguous.
 *
 * @param host - Station hostname or IP address.
 * @param port - HTTP port serving `aircraft.json`.
 * @returns The full endpoint URL.
 */
function buildAircraftJsonUrl(host: string, port: number): string {
  const urlHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `http://${urlHost}:${port}/data/aircraft.json`;
}

/**
 * Picks out the tracker options shared by every source, leaving unset ones
 * absent rather than present-but-undefined.
 *
 * @param options - The full source-agnostic options bag.
 * @returns Only the `AircraftFeedOptions` subset.
 */
function pickTrackerOptions(options: SourceFeedOptions): AircraftFeedOptions {
  return {
    ...(options.staleAfterMs !== undefined && { staleAfterMs: options.staleAfterMs }),
    ...(options.sweepIntervalMs !== undefined && { sweepIntervalMs: options.sweepIntervalMs }),
    ...(options.positionHistoryRetention !== undefined && {
      positionHistoryRetention: options.positionHistoryRetention,
    }),
  };
}

/**
 * Creates a live aircraft feed for a source chosen at runtime, dispatching to
 * `createJsonAircraftFeed`, `createSbsAircraftFeed`, or
 * `createBeastAircraftFeed`. Meant for callers that take the source from a
 * CLI flag or config value and want one call site instead of a switch.
 * Node-only, since the SBS and Beast sources are - not exported from this
 * package's `/browser` entry.
 *
 * `port` defaults to the selected source's entry in
 * {@link DEFAULT_PORT_BY_SOURCE}. For the `json` source the endpoint is
 * `url` when given, otherwise dump1090-fa's standard
 * `http://<host>:<port>/data/aircraft.json`. Options that do not apply to the
 * selected source are ignored.
 *
 * ```typescript
 * import { createAircraftFeedForSource } from '@squawk/adsb-feed';
 *
 * const feed = createAircraftFeedForSource({ source: 'beast', host: '192.168.1.50' });
 * feed.addEventListener('aircraft:update', (event) => {
 *   console.log((event as CustomEvent).detail.aircraft);
 * });
 * feed.start();
 * ```
 *
 * @param options - The source to connect to, station host/port, per-source extras, and tracker configuration.
 * @returns An `AircraftFeed` ready to `start()`.
 */
export function createAircraftFeedForSource(options: SourceFeedOptions): AircraftFeed {
  const port = options.port ?? DEFAULT_PORT_BY_SOURCE[options.source];
  const trackerOptions = pickTrackerOptions(options);
  switch (options.source) {
    case 'json':
      return createJsonAircraftFeed({
        ...trackerOptions,
        url: options.url ?? buildAircraftJsonUrl(options.host, port),
        ...(options.pollIntervalMs !== undefined && { pollIntervalMs: options.pollIntervalMs }),
        ...(options.fetch !== undefined && { fetch: options.fetch }),
      });
    case 'sbs':
      return createSbsAircraftFeed({
        ...trackerOptions,
        host: options.host,
        port,
        ...(options.reconnectDelayMs !== undefined && {
          reconnectDelayMs: options.reconnectDelayMs,
        }),
      });
    case 'beast':
      return createBeastAircraftFeed({
        ...trackerOptions,
        host: options.host,
        port,
        ...(options.reconnectDelayMs !== undefined && {
          reconnectDelayMs: options.reconnectDelayMs,
        }),
        ...(options.receiverPosition !== undefined && {
          receiverPosition: options.receiverPosition,
        }),
      });
  }
}
