import { createServer } from 'node:net';
import type { Server, Socket } from 'node:net';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createBeastStream } from './stream.js';
import type { BeastConnectEventDetail, BeastDisconnectEventDetail, BeastFrameErrorEventDetail, BeastMessageEventDetail } from './types.js';

/** Collects the `detail` payload of every event of `type` dispatched on `target`, in dispatch order. */
function collectEventDetails<T>(target: EventTarget, type: string): T[] {
  const details: T[] = [];
  target.addEventListener(type, (event) => {
    details.push((event as CustomEvent<T>).detail);
  });
  return details;
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitUntil timed out');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// Real DF11 all-call reply, hand-verified elsewhere in this monorepo's
// mode-s package tests. Wrapped in Beast short-frame (0x32) escape-framing.
const DF11_FRAME = Buffer.from([
  0x1a, 0x32, 0, 0, 0, 0, 0, 1, 0x80, 0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68,
]);

describe('createBeastStream', () => {
  let server: Server;
  let port: number;
  let serverSockets: Socket[];

  beforeEach(async () => {
    serverSockets = [];
    server = createServer((socket) => {
      serverSockets.push(socket);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('expected a TCP address');
    }
    port = address.port;
  });

  afterEach(async () => {
    for (const socket of serverSockets) {
      socket.destroy();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('dispatches beast:connect on connection and beast:message for a received frame', async () => {
    const stream = createBeastStream({ host: '127.0.0.1', port });
    const connects = collectEventDetails<BeastConnectEventDetail>(stream, 'beast:connect');
    const messages = collectEventDetails<BeastMessageEventDetail>(stream, 'beast:message');

    stream.start();
    await waitUntil(() => serverSockets.length === 1);
    await waitUntil(() => connects.length === 1);

    serverSockets[0]?.write(DF11_FRAME);
    await waitUntil(() => messages.length === 1);

    expect(connects[0]).toEqual({ host: '127.0.0.1', port });
    expect(messages[0]?.frame.type).toBe('shortModeS');
    expect(messages[0]?.frame.decoded?.kind).toBe('allCallReply');

    stream.stop();
  });

  it('reassembles a frame split across two socket writes', async () => {
    const stream = createBeastStream({ host: '127.0.0.1', port });
    const messages = collectEventDetails<BeastMessageEventDetail>(stream, 'beast:message');

    stream.start();
    await waitUntil(() => serverSockets.length === 1);

    serverSockets[0]?.write(DF11_FRAME.subarray(0, 6));
    await new Promise((resolve) => setTimeout(resolve, 20));
    serverSockets[0]?.write(DF11_FRAME.subarray(6));
    await waitUntil(() => messages.length === 1);

    expect(messages[0]?.frame.decoded?.kind).toBe('allCallReply');

    stream.stop();
  });

  it('dispatches beast:frameError for malformed bytes', async () => {
    const stream = createBeastStream({ host: '127.0.0.1', port });
    const errors = collectEventDetails<BeastFrameErrorEventDetail>(stream, 'beast:frameError');

    stream.start();
    await waitUntil(() => serverSockets.length === 1);

    serverSockets[0]?.write(Buffer.from([0x00, 0x01, 0x02]));
    await waitUntil(() => errors.length === 1);

    expect(errors[0]?.error.reason).toBe('malformedFraming');

    stream.stop();
  });

  it('dispatches beast:disconnect and reconnects after the server closes the connection', async () => {
    const stream = createBeastStream({ host: '127.0.0.1', port, reconnectDelayMs: 50 });
    const disconnects = collectEventDetails<BeastDisconnectEventDetail>(stream, 'beast:disconnect');

    stream.start();
    await waitUntil(() => serverSockets.length === 1);

    serverSockets[0]?.end();
    await waitUntil(() => disconnects.length === 1);
    expect(disconnects[0]?.reconnectDelayMs).toBe(50);

    await waitUntil(() => serverSockets.length === 2, 3000);

    stream.stop();
  });

  it('does not open a spurious second connection when stop() is followed immediately by start()', async () => {
    // Regression test: destroying a socket only queues its 'close' event
    // for a later tick, not synchronously. An earlier version of the
    // 'close' handler had no way to tell a stale event (from the socket
    // stop() just destroyed) apart from a genuine disconnect of the
    // *current* socket, so a stop()+start() in quick succession could let
    // the stale event fire after the new connection was already up,
    // triggering a spurious reconnect that orphaned the new connection.
    const stream = createBeastStream({ host: '127.0.0.1', port, reconnectDelayMs: 20 });
    const disconnects = collectEventDetails<BeastDisconnectEventDetail>(stream, 'beast:disconnect');

    stream.start();
    await waitUntil(() => serverSockets.length === 1);

    stream.stop();
    stream.start();
    await waitUntil(() => serverSockets.length === 2);

    // Give the first socket's deferred 'close' event, and any reconnect
    // timer it might incorrectly schedule, time to fire.
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(serverSockets.length).toBe(2);
    expect(disconnects).toHaveLength(0);

    stream.stop();
  });

  it('does not reconnect after stop()', async () => {
    const stream = createBeastStream({ host: '127.0.0.1', port, reconnectDelayMs: 20 });
    stream.start();
    await waitUntil(() => serverSockets.length === 1);

    stream.stop();
    serverSockets[0]?.end();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(serverSockets.length).toBe(1);
  });

  it('cancels a pending reconnect timer when stop() is called before it fires', async () => {
    const stream = createBeastStream({ host: '127.0.0.1', port, reconnectDelayMs: 500 });
    const disconnects = collectEventDetails<BeastDisconnectEventDetail>(stream, 'beast:disconnect');
    stream.start();
    await waitUntil(() => serverSockets.length === 1);

    serverSockets[0]?.end();
    await waitUntil(() => disconnects.length === 1); // reconnect timer is now scheduled

    stream.stop();
    await new Promise((resolve) => setTimeout(resolve, 700)); // past reconnectDelayMs

    expect(serverSockets.length).toBe(1);
  });

  it('start() is a no-op when already started', async () => {
    const stream = createBeastStream({ host: '127.0.0.1', port });
    stream.start();
    stream.start();
    await waitUntil(() => serverSockets.length === 1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(serverSockets.length).toBe(1);
    stream.stop();
  });

  it('stop() is a no-op when already stopped', () => {
    const stream = createBeastStream({ host: '127.0.0.1', port });
    expect(() => stream.stop()).not.toThrow();
  });
});
