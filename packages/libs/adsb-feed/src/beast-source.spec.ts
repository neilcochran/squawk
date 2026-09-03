import { createServer } from 'node:net';
import type { Server, Socket } from 'node:net';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createBeastAircraftFeed } from './beast-source.js';
import { collectEventDetails } from './test-utils.js';
import type { AircraftUpdateEventDetail } from './types/index.js';

let server: Server;
let port: number;
let serverSockets: Socket[];

beforeEach(async () => {
  serverSockets = [];
  server = createServer((socket) => {
    serverSockets.push(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('expected a bound TCP address');
  }
  port = address.port;
});

afterEach(async () => {
  for (const socket of serverSockets) {
    socket.destroy();
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function waitForServerConnection(): Promise<Socket> {
  return new Promise((resolve) => {
    server.once('connection', resolve);
  });
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Wraps raw message bytes in Beast escape-framing: 0x1a, type byte, a fixed
 * timestamp/signal, then the message with 0x1a bytes doubled. Mirrors
 * `@squawk/beast`'s own `frame.spec.ts` helper.
 */
function frameBytes(typeByte: number, message: number[]): Buffer {
  const escaped: number[] = [];
  for (const byte of message) {
    escaped.push(byte);
    if (byte === 0x1a) {
      escaped.push(0x1a);
    }
  }
  const timestamp = [0, 0, 0, 0, 0, 1];
  const signal = [0x80];
  return Buffer.from([0x1a, typeByte, ...timestamp, ...signal, ...escaped]);
}

// Real DF17 airborne position message, hand-verified CRC=0 (see @squawk/beast's frame.spec.ts).
const DF17_POSITION = [
  0x8d, 0xab, 0x09, 0x69, 0x58, 0xc9, 0x01, 0x06, 0xe9, 0x19, 0x9e, 0x88, 0xd1, 0xa5,
];
// Real DF11 all-call reply, same aircraft.
const DF11_ALL_CALL = [0x5d, 0xab, 0x09, 0x69, 0x30, 0xe6, 0x68];

describe('connecting and parsing', () => {
  it('connects to the configured host/port and ingests a decoded message the server sends', async () => {
    const feed = createBeastAircraftFeed({ host: '127.0.0.1', port });
    const events = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    serverSocket.write(frameBytes(0x32, DF11_ALL_CALL));

    await waitUntil(() => events.length === 1);
    expect(events[0]?.aircraft.icaoHex).toBe('AB0969');

    feed.stop();
  });

  it('decodes a real DF17 long Mode-S frame end to end', async () => {
    const feed = createBeastAircraftFeed({ host: '127.0.0.1', port });
    const events = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    serverSocket.write(frameBytes(0x33, DF17_POSITION));

    await waitUntil(() => events.length === 1);
    expect(events[0]?.aircraft.icaoHex).toBe('AB0969');

    feed.stop();
  });

  it('buffers a frame split across two writes', async () => {
    const feed = createBeastAircraftFeed({ host: '127.0.0.1', port });
    const events = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    const framed = frameBytes(0x32, DF11_ALL_CALL);
    serverSocket.write(framed.subarray(0, 5));
    serverSocket.write(framed.subarray(5));

    await waitUntil(() => events.length === 1);
    expect(events[0]?.aircraft.icaoHex).toBe('AB0969');

    feed.stop();
  });

  it('ignores an undecodable frame without crashing', async () => {
    const feed = createBeastAircraftFeed({ host: '127.0.0.1', port });
    const events = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    // Mode A/C reply - decodes, but carries no ICAO address to key on.
    serverSocket.write(frameBytes(0x31, [0x12, 0x00]));
    serverSocket.write(frameBytes(0x32, DF11_ALL_CALL));

    await waitUntil(() => events.length === 1);
    expect(events[0]?.aircraft.icaoHex).toBe('AB0969');

    feed.stop();
  });
});

describe('stop', () => {
  it('clears tracked aircraft', async () => {
    const feed = createBeastAircraftFeed({ host: '127.0.0.1', port });

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    serverSocket.write(frameBytes(0x32, DF11_ALL_CALL));
    await waitUntil(() => feed.getAllAircraft().length === 1);

    feed.stop();
    expect(feed.getAllAircraft()).toHaveLength(0);
  });

  it('is a no-op when already stopped', () => {
    const feed = createBeastAircraftFeed({ host: '127.0.0.1', port });
    expect(() => feed.stop()).not.toThrow();
  });

  it('closes the connection and prevents further reconnect attempts', async () => {
    const feed = createBeastAircraftFeed({ host: '127.0.0.1', port, reconnectDelayMs: 20 });
    let connectionCount = 0;
    server.on('connection', () => {
      connectionCount++;
    });

    const connection = waitForServerConnection();
    feed.start();
    await connection;
    feed.stop();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(connectionCount).toBe(1);
  });
});
