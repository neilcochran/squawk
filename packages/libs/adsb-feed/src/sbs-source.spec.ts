import { createServer } from 'node:net';
import type { Server, Socket } from 'node:net';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createSbsAircraftFeed } from './sbs-source.js';
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

describe('connecting and parsing', () => {
  it('connects to the configured host/port and ingests a line the server sends', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port });
    const events = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    serverSocket.write('MSG,1,1,1,A0B1C2,1,,,,,UAL123  ,,,,,,,,,,,\n');

    await waitUntil(() => events.length === 1);
    expect(events[0]?.aircraft.callsign).toBe('UAL123');

    feed.stop();
  });

  it('buffers a line split across two writes', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port });
    const events = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    serverSocket.write('MSG,1,1,1,A0B1C2,1,,,,,UAL');
    serverSocket.write('123  ,,,,,,,,,,,\n');

    await waitUntil(() => events.length === 1);
    expect(events[0]?.aircraft.callsign).toBe('UAL123');

    feed.stop();
  });

  it('processes multiple lines delivered in a single write', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port });
    const events = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    serverSocket.write(
      'MSG,1,1,1,A0B1C2,1,,,,,UAL123  ,,,,,,,,,,,\nMSG,1,1,1,B1C2D3,1,,,,,DAL456  ,,,,,,,,,,,\n',
    );

    await waitUntil(() => events.length === 2);
    expect(events.map((e) => e.aircraft.icaoHex).sort()).toEqual(['A0B1C2', 'B1C2D3']);

    feed.stop();
  });

  it('ignores a blank line without crashing', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port });
    const events = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    serverSocket.write('\n\nMSG,1,1,1,A0B1C2,1,,,,,UAL123  ,,,,,,,,,,,\n');

    await waitUntil(() => events.length === 1);
    expect(events[0]?.aircraft.icaoHex).toBe('A0B1C2');

    feed.stop();
  });

  it('ignores a non-MSG line without crashing', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port });
    const events = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    serverSocket.write('STA,1,1,1,A0B1C2,1,,,,,,,,,,,,,,,,\n');
    serverSocket.write('MSG,1,1,1,A0B1C2,1,,,,,UAL123  ,,,,,,,,,,,\n');

    await waitUntil(() => events.length === 1);
    expect(events[0]?.aircraft.icaoHex).toBe('A0B1C2');

    feed.stop();
  });
});

describe('reconnection', () => {
  it('reconnects after the connection closes, after reconnectDelayMs', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port, reconnectDelayMs: 20 });
    let connectionCount = 0;
    server.on('connection', () => {
      connectionCount++;
    });

    const firstConnection = waitForServerConnection();
    feed.start();
    const firstSocket = await firstConnection;

    const secondConnection = waitForServerConnection();
    firstSocket.destroy();
    await secondConnection;

    expect(connectionCount).toBe(2);
    feed.stop();
  });

  it('does not throw when the initial connection is refused', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port, reconnectDelayMs: 20 });

    expect(() => feed.start()).not.toThrow();
    feed.stop();
  });

  it('is a no-op to start an already-started feed', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port });
    let connectionCount = 0;
    server.on('connection', () => {
      connectionCount++;
    });

    const connection = waitForServerConnection();
    feed.start();
    feed.start();
    await connection;

    expect(connectionCount).toBe(1);
    feed.stop();
  });
});

describe('stop', () => {
  it('closes the connection and prevents further reconnect attempts', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port, reconnectDelayMs: 20 });
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

  it('cancels a reconnect that was already scheduled when stop() is called', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port, reconnectDelayMs: 50 });
    let connectionCount = 0;
    server.on('connection', () => {
      connectionCount++;
    });

    const firstConnection = waitForServerConnection();
    feed.start();
    const firstSocket = await firstConnection;
    firstSocket.destroy();
    // Give the client socket's own 'close' event (and the reconnect timer it
    // schedules) time to fire, without waiting long enough for the 50ms
    // reconnectDelayMs itself to elapse - stop() should cancel that pending
    // timer before it fires.
    await new Promise((resolve) => setTimeout(resolve, 10));
    feed.stop();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(connectionCount).toBe(1);
  });

  it('is a no-op when already stopped', () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port });
    expect(() => feed.stop()).not.toThrow();
  });

  it('clears tracked aircraft', async () => {
    const feed = createSbsAircraftFeed({ host: '127.0.0.1', port });

    const connection = waitForServerConnection();
    feed.start();
    const serverSocket = await connection;
    serverSocket.write('MSG,1,1,1,A0B1C2,1,,,,,UAL123  ,,,,,,,,,,,\n');
    await waitUntil(() => feed.getAllAircraft().length === 1);

    feed.stop();
    expect(feed.getAllAircraft()).toHaveLength(0);
  });
});
