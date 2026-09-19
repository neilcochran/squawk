import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AircraftFeed } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import type { ScopeConfig } from '../shared/protocol.js';

import { createScopeServer, STREAM_RETRY_MS } from './http-server.js';
import type { ScopeServer } from './http-server.js';

const CONFIG: ScopeConfig = {
  receiver: { lat: 40, lon: -74 },
  source: 'beast',
  station: '192.168.1.50:30005',
  rangeNm: 60,
};

interface SimpleResponse {
  status: number;
  headers: IncomingMessage['headers'];
  body: string;
}

let publicDir: string;
let server: ScopeServer | undefined;
let aircraft: Aircraft[] = [];

function makeFeed(): AircraftFeed {
  return Object.assign(new EventTarget(), {
    start: vi.fn(),
    stop: vi.fn(),
    getAircraft: vi.fn(() => undefined),
    getAllAircraft: vi.fn(() => aircraft),
    getPositionHistory: vi.fn(() => []),
    getConnectionState: vi.fn(() => 'connected' as const),
  });
}

async function startServer(snapshotIntervalMs = 1000): Promise<number> {
  server = createScopeServer({
    feed: makeFeed(),
    config: CONFIG,
    publicDir,
    allowedHostnames: ['localhost'],
    snapshotIntervalMs,
    now: () => 1_000_000,
  });
  return server.listen(0, '127.0.0.1');
}

function send(
  port: number,
  path: string,
  options: { method?: string; host?: string } = {},
): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: options.method ?? 'GET',
        headers: { Host: options.host ?? `127.0.0.1:${port}` },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    outgoing.on('error', reject);
    outgoing.end();
  });
}

/** Opens the stream and resolves once `eventCount` snapshot events have arrived. */
function readStream(port: number, eventCount: number): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      { host: '127.0.0.1', port, path: '/api/stream', headers: { Host: `127.0.0.1:${port}` } },
      (response) => {
        let body = '';
        response.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8');
          if (body.split('event: snapshot').length - 1 >= eventCount) {
            outgoing.destroy();
            resolve({ status: response.statusCode ?? 0, headers: response.headers, body });
          }
        });
      },
    );
    outgoing.on('error', (error) => {
      if (!outgoing.destroyed) {
        reject(error);
      }
    });
    outgoing.end();
  });
}

beforeAll(async () => {
  publicDir = await mkdtemp(join(tmpdir(), 'adsbscope-public-'));
  await mkdir(join(publicDir, 'assets'));
  await writeFile(join(publicDir, 'index.html'), '<!doctype html><title>scope</title>');
  await writeFile(join(publicDir, 'assets', 'app.js'), 'console.log(1);');
});

afterAll(async () => {
  await rm(publicDir, { recursive: true, force: true });
});

afterEach(async () => {
  aircraft = [];
  await server?.close();
  server = undefined;
});

describe('createScopeServer', () => {
  it('serves the session config as JSON', async () => {
    const port = await startServer();

    const response = await send(port, '/api/config');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(JSON.parse(response.body)).toEqual(CONFIG);
  });

  it('ignores a query string when routing', async () => {
    const port = await startServer();

    expect((await send(port, '/api/config?x=1')).status).toBe(200);
  });

  it('answers HEAD for the config and for static files without a body', async () => {
    const port = await startServer();

    const config = await send(port, '/api/config', { method: 'HEAD' });
    const index = await send(port, '/', { method: 'HEAD' });

    expect(config.status).toBe(200);
    expect(config.body).toBe('');
    expect(index.status).toBe(200);
    expect(index.headers['content-length']).toBe('35');
    expect(index.body).toBe('');
  });

  it('serves the built UI with security headers', async () => {
    const port = await startServer();

    const index = await send(port, '/');
    const script = await send(port, '/assets/app.js');

    expect(index.status).toBe(200);
    expect(index.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(index.headers['x-content-type-options']).toBe('nosniff');
    expect(index.headers['content-security-policy']).toBe("default-src 'self'");
    expect(index.body).toContain('<title>scope</title>');
    expect(script.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(script.body).toBe('console.log(1);');
  });

  it('returns 404 for a missing file, a directory, and a path outside the UI directory', async () => {
    const port = await startServer();

    expect((await send(port, '/missing.js')).status).toBe(404);
    expect((await send(port, '/assets')).status).toBe(404);
    expect((await send(port, '/%2e%2e/%2e%2e/etc/passwd')).status).toBe(404);
  });

  it('refuses methods other than GET and HEAD', async () => {
    const port = await startServer();

    const response = await send(port, '/api/config', { method: 'POST' });

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('GET, HEAD');
  });

  it('refuses a request whose Host header is not this server', async () => {
    const port = await startServer();

    expect((await send(port, '/api/config', { host: 'evil.example.com' })).status).toBe(403);
    expect((await send(port, '/api/config', { host: `localhost:${port}` })).status).toBe(200);
  });

  it('streams a snapshot immediately on connect, then on every interval', async () => {
    aircraft = [{ icaoHex: 'a1b2c3', callsign: 'UAL123', lastSeenAt: 999_000 }];
    const port = await startServer(20);

    const response = await readStream(port, 3);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/event-stream');
    expect(response.body.startsWith(`retry: ${STREAM_RETRY_MS}\n\nevent: snapshot\ndata: `)).toBe(
      true,
    );
    const firstData = response.body.split('\n').find((line) => line.startsWith('data: '));
    expect(JSON.parse(firstData?.slice('data: '.length) ?? 'null')).toEqual({
      at: 1_000_000,
      connection: 'connected',
      targets: [{ icaoHex: 'a1b2c3', callsign: 'UAL123', history: [], lastSeenAt: 999_000 }],
    });
  });

  it('does not route HEAD to the stream', async () => {
    const port = await startServer();

    expect((await send(port, '/api/stream', { method: 'HEAD' })).status).toBe(404);
  });

  it('stops sending to a client that has disconnected', async () => {
    const port = await startServer(10);
    await readStream(port, 1);
    await new Promise<void>((resolve) => setTimeout(resolve, 40));

    expect((await send(port, '/api/config')).status).toBe(200);
  });

  it('ends open streams when closed', async () => {
    const port = await startServer();
    const ended = new Promise<void>((resolve, reject) => {
      const outgoing = request(
        { host: '127.0.0.1', port, path: '/api/stream', headers: { Host: `127.0.0.1:${port}` } },
        (response) => {
          response.on('data', () => undefined);
          response.on('end', () => resolve());
          response.on('close', () => resolve());
        },
      );
      outgoing.on('error', reject);
      outgoing.end();
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 30));

    await server?.close();
    server = undefined;

    await expect(ended).resolves.toBeUndefined();
  });

  it('rejects listen when the port is already taken', async () => {
    const port = await startServer();
    const second = createScopeServer({
      feed: makeFeed(),
      config: CONFIG,
      publicDir,
      allowedHostnames: [],
    });

    await expect(second.listen(port, '127.0.0.1')).rejects.toThrow();
  });
});
