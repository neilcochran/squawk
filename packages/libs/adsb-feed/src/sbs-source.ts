import { connect } from 'node:net';
import type { Socket } from 'node:net';

import { parseSbsLine } from './sbs-mapping.js';
import { createTracker } from './tracker.js';
import type { AircraftFeed, SbsFeedOptions } from './types/index.js';

/** Default SBS/BaseStation TCP port. */
const DEFAULT_PORT = 30003;
/** Default delay before attempting to reconnect after the connection closes. */
const DEFAULT_RECONNECT_DELAY_MS = 5000;

/**
 * Creates a live aircraft feed backed by a persistent TCP connection to
 * dump1090-fa's SBS/BaseStation output. Node-only (raw TCP sockets have no
 * browser API) - not exported from this package's `/browser` entry.
 *
 * Reconnects automatically, after `reconnectDelayMs`, if the connection
 * closes or errors, until `stop()` is called.
 *
 * ```typescript
 * import { createSbsAircraftFeed } from '@squawk/adsb-feed';
 *
 * const feed = createSbsAircraftFeed({ host: '192.168.1.50' });
 * feed.addEventListener('aircraft:update', (event) => {
 *   console.log((event as CustomEvent).detail.aircraft);
 * });
 * feed.start();
 * ```
 *
 * @param options - Station host/port, reconnect delay, and tracker configuration.
 * @returns An `AircraftFeed` ready to `start()`.
 */
export function createSbsAircraftFeed(options: SbsFeedOptions): AircraftFeed {
  const tracker = createTracker(options);
  const port = options.port ?? DEFAULT_PORT;
  const reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;

  let socket: Socket | undefined;
  let reconnectHandle: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;
  let buffer = '';

  function handleData(chunk: string): void {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const update = parseSbsLine(trimmed);
      if (update) {
        tracker.ingest(update);
      }
    }
  }

  function scheduleReconnect(): void {
    if (stopped || reconnectHandle !== undefined) {
      return;
    }
    reconnectHandle = setTimeout(() => {
      reconnectHandle = undefined;
      connectSocket();
    }, reconnectDelayMs);
  }

  function connectSocket(): void {
    buffer = '';
    const nextSocket = connect({ host: options.host, port });
    socket = nextSocket;
    nextSocket.setEncoding('utf8');
    nextSocket.on('data', handleData);
    // A listener is required so a connection failure (e.g. dump1090-fa not
    // yet reachable) doesn't crash the process - 'close' always follows
    // 'error' on a socket, and reconnection is scheduled there so it only
    // happens once per failed attempt.
    nextSocket.on('error', () => undefined);
    nextSocket.on('close', scheduleReconnect);
  }

  return Object.assign(tracker, {
    start(): void {
      if (!stopped) {
        return;
      }
      stopped = false;
      connectSocket();
    },
    stop(): void {
      stopped = true;
      if (reconnectHandle !== undefined) {
        clearTimeout(reconnectHandle);
        reconnectHandle = undefined;
      }
      socket?.destroy();
      socket = undefined;
      tracker.dispose();
    },
  });
}
