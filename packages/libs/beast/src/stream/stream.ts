import { connect } from 'node:net';
import type { Socket } from 'node:net';

import { deframeBeastBytes } from '../frame.js';

import type {
  BeastConnectEventDetail,
  BeastDisconnectEventDetail,
  BeastFrameErrorEventDetail,
  BeastMessageEventDetail,
  BeastStream,
  BeastStreamOptions,
} from './types.js';

/** Default Beast TCP port (dump1090-fa's default Beast output). */
const DEFAULT_PORT = 30005;
/** Default delay before attempting to reconnect after the connection closes. */
const DEFAULT_RECONNECT_DELAY_MS = 5000;

/**
 * Creates a live client for a Beast-format TCP feed (dump1090-fa, readsb,
 * or a real Mode-S Beast dongle). Node-only (raw TCP sockets have no
 * browser API) - not exported from this package's main entry or its
 * `/browser` subpath, only from `/stream`.
 *
 * Reconnects automatically, after `reconnectDelayMs`, if the connection
 * closes or errors, until `stop()` is called.
 *
 * ```typescript
 * import { createBeastStream } from '@squawk/beast/stream';
 *
 * const stream = createBeastStream({ host: '192.168.1.50' });
 * stream.addEventListener('beast:message', (event) => {
 *   console.log((event as CustomEvent).detail.frame);
 * });
 * stream.start();
 * ```
 *
 * @param options - Feed host/port and reconnect delay.
 * @returns A `BeastStream` ready to `start()`.
 */
export function createBeastStream(options: BeastStreamOptions): BeastStream {
  const target = new EventTarget();
  const port = options.port ?? DEFAULT_PORT;
  const reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;

  let socket: Socket | undefined;
  let reconnectHandle: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;
  let pending: Uint8Array = new Uint8Array(0);

  function handleData(chunk: Buffer): void {
    const combined = new Uint8Array(pending.length + chunk.length);
    combined.set(pending);
    combined.set(chunk, pending.length);

    const result = deframeBeastBytes(combined);
    pending = result.remainder;

    for (const frame of result.frames) {
      const detail: BeastMessageEventDetail = { frame };
      target.dispatchEvent(new CustomEvent<BeastMessageEventDetail>('beast:message', { detail }));
    }
    for (const error of result.errors) {
      const detail: BeastFrameErrorEventDetail = { error };
      target.dispatchEvent(
        new CustomEvent<BeastFrameErrorEventDetail>('beast:frameError', { detail }),
      );
    }
  }

  function scheduleReconnect(): void {
    const detail: BeastDisconnectEventDetail = { host: options.host, port, reconnectDelayMs };
    target.dispatchEvent(
      new CustomEvent<BeastDisconnectEventDetail>('beast:disconnect', { detail }),
    );
    reconnectHandle = setTimeout(() => {
      reconnectHandle = undefined;
      connectSocket();
    }, reconnectDelayMs);
  }

  function connectSocket(): void {
    pending = new Uint8Array(0);
    const nextSocket = connect({ host: options.host, port });
    socket = nextSocket;
    nextSocket.on('data', handleData);
    nextSocket.on('connect', () => {
      const detail: BeastConnectEventDetail = { host: options.host, port };
      target.dispatchEvent(new CustomEvent<BeastConnectEventDetail>('beast:connect', { detail }));
    });
    // A listener is required so a connection failure doesn't crash the
    // process - 'close' always follows 'error' on a socket, and
    // reconnection is scheduled there so it only happens once per attempt.
    nextSocket.on('error', () => undefined);
    // Guarded by identity: destroying a socket (e.g. in stop()) only
    // queues its 'close' event for a later tick, so a stop()+start() in
    // quick succession can let a stale socket's 'close' fire after a new
    // one is already active. This check confines scheduleReconnect to the
    // one socket generation that is actually still current.
    //
    // scheduleReconnect itself needs no further guard: `stop()` sets
    // `stopped = true` and `socket = undefined` together, synchronously,
    // in the same call - so if this check ever passes (`socket` still
    // equals this specific instance), `stop()` cannot have run since this
    // socket became current, meaning `stopped` is guaranteed false and no
    // reconnect can already be pending here.
    nextSocket.on('close', () => {
      if (socket === nextSocket) {
        scheduleReconnect();
      }
    });
  }

  return Object.assign(target, {
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
      pending = new Uint8Array(0);
    },
  });
}
