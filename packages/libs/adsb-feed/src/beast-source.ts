import { createBeastStream } from '@squawk/beast/stream';
import type { BeastMessageEventDetail } from '@squawk/beast/stream';

import { createBeastMapper } from './beast-mapping.js';
import { createTracker } from './tracker.js';
import type { AircraftFeed, AircraftLostEventDetail, BeastFeedOptions } from './types/index.js';

/**
 * Creates a live aircraft feed backed by a persistent TCP connection to a
 * Beast-format feed (dump1090-fa, readsb, or a real Mode-S Beast dongle).
 * Node-only (raw TCP sockets have no browser API) - not exported from this
 * package's `/browser` entry, same as `createSbsAircraftFeed`.
 *
 * Unlike the JSON and SBS sources, Beast carries raw, undecoded Mode-S/ADS-B
 * messages - this decodes them via `@squawk/beast`/`@squawk/mode-s` and
 * resolves CPR-encoded positions internally (see `BeastFeedOptions.receiverPosition`
 * for what that needs). Reconnects automatically, after `reconnectDelayMs`,
 * if the connection closes or errors, until `stop()` is called. Forwards
 * `@squawk/beast`'s own `beast:connect`/`beast:disconnect` signal into the
 * returned feed's `connection:connect`/`connection:disconnect` events and
 * `getConnectionState()`.
 *
 * ```typescript
 * import { createBeastAircraftFeed } from '@squawk/adsb-feed';
 *
 * const feed = createBeastAircraftFeed({ host: '192.168.1.50' });
 * feed.addEventListener('aircraft:update', (event) => {
 *   console.log((event as CustomEvent).detail.aircraft);
 * });
 * feed.start();
 * ```
 *
 * @param options - Station host/port, receiver position, reconnect delay, and tracker configuration.
 * @returns An `AircraftFeed` ready to `start()`.
 */
export function createBeastAircraftFeed(options: BeastFeedOptions): AircraftFeed {
  const tracker = createTracker(options);
  const mapper = createBeastMapper(
    options.receiverPosition !== undefined ? { receiverPosition: options.receiverPosition } : {},
  );
  const stream = createBeastStream({
    host: options.host,
    ...(options.port !== undefined && { port: options.port }),
    ...(options.reconnectDelayMs !== undefined && { reconnectDelayMs: options.reconnectDelayMs }),
  });

  stream.addEventListener('beast:message', (event) => {
    const { frame } = (event as CustomEvent<BeastMessageEventDetail>).detail;
    const update = mapper.map(frame.decoded, (icaoHex) => tracker.getAircraft(icaoHex));
    if (update) {
      tracker.ingest(update);
    }
  });
  stream.addEventListener('beast:connect', () => {
    tracker.setConnectionState('connected');
  });
  stream.addEventListener('beast:disconnect', () => {
    tracker.setConnectionState('reconnecting');
  });
  tracker.addEventListener('aircraft:lost', (event) => {
    mapper.forget((event as CustomEvent<AircraftLostEventDetail>).detail.icaoHex);
  });

  return Object.assign(tracker, {
    start(): void {
      stream.start();
    },
    stop(): void {
      stream.stop();
      tracker.dispose();
    },
  });
}
