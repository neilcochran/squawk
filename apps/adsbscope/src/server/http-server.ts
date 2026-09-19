import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import type { AircraftFeed } from '@squawk/adsb-feed';

import { CONFIG_PATH, SNAPSHOT_EVENT, STREAM_PATH } from '../shared/protocol.js';
import type { ScopeConfig } from '../shared/protocol.js';

import { isAllowedHost } from './host-check.js';
import { buildSnapshot } from './snapshot.js';
import { contentTypeFor, resolveStaticPath } from './static-files.js';

/** Default time between snapshots pushed to connected browsers. */
export const DEFAULT_SNAPSHOT_INTERVAL_MS = 1000;

/** How long a browser waits before reconnecting a dropped stream, sent as the stream's `retry` field. */
export const STREAM_RETRY_MS = 2000;

const ALLOWED_METHODS = ['GET', 'HEAD'] as const;
const PLAIN_TEXT_CONTENT = 'text/plain; charset=utf-8';
const JSON_CONTENT = 'application/json; charset=utf-8';
const EVENT_STREAM_CONTENT = 'text/event-stream';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'no-referrer',
};

/** Options for {@link createScopeServer}. */
export interface ScopeServerOptions {
  /** The feed whose aircraft are streamed to the UI. The caller owns its `start()`/`stop()`. */
  feed: AircraftFeed;
  /** Session settings served to the UI at startup. */
  config: ScopeConfig;
  /** Absolute path of the directory the UI was built into. */
  publicDir: string;
  /** Lowercased hostnames accepted in the `Host` header besides IP literals - see `isAllowedHost`. */
  allowedHostnames: readonly string[];
  /** Time between snapshots pushed to connected browsers. Defaults to {@link DEFAULT_SNAPSHOT_INTERVAL_MS}. */
  snapshotIntervalMs?: number;
  /** Clock, injectable for tests. Defaults to `Date.now`. */
  now?: () => number;
}

/** A running (or ready to run) scope UI server. */
export interface ScopeServer {
  /**
   * Starts listening.
   *
   * @param port - TCP port to listen on; 0 picks a free one.
   * @param bindAddress - Local address to bind to.
   * @returns The port actually bound.
   */
  listen(port: number, bindAddress: string): Promise<number>;
  /** Stops streaming, closes every open connection, and stops listening. */
  close(): Promise<void>;
}

function sendPlain(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': PLAIN_TEXT_CONTENT });
  response.end(message);
}

function sendNotFound(response: ServerResponse): void {
  sendPlain(response, 404, 'Not found');
}

/**
 * Creates the HTTP server behind the scope UI. It serves the built UI as
 * static files, the session {@link ScopeConfig} as JSON, and a server-sent
 * events stream that pushes a fresh snapshot of the feed to every connected
 * browser on a fixed interval (and one immediately on connect, so a new tab
 * never starts blank).
 *
 * The server only reads from the feed it is given and never makes outbound
 * requests, so it cannot be used as a proxy. Requests are limited to `GET`
 * and `HEAD`, and any request whose `Host` header is neither an IP literal
 * nor an allowed hostname is refused - see `isAllowedHost`.
 *
 * @param options - Feed, session config, UI directory, allowed hostnames, and timing.
 * @returns The server, not yet listening.
 */
export function createScopeServer(options: ScopeServerOptions): ScopeServer {
  const now = options.now ?? Date.now;
  const snapshotIntervalMs = options.snapshotIntervalMs ?? DEFAULT_SNAPSHOT_INTERVAL_MS;
  const streamClients = new Set<ServerResponse>();
  let snapshotTimer: ReturnType<typeof setInterval> | undefined;

  function formatSnapshotMessage(): string {
    const snapshot = buildSnapshot(options.feed, options.config.receiver, now());
    return `event: ${SNAPSHOT_EVENT}\ndata: ${JSON.stringify(snapshot)}\n\n`;
  }

  function broadcastSnapshot(): void {
    if (streamClients.size === 0) {
      return;
    }
    const message = formatSnapshotMessage();
    for (const client of streamClients) {
      client.write(message);
    }
  }

  function handleStream(request: IncomingMessage, response: ServerResponse): void {
    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': EVENT_STREAM_CONTENT,
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write(`retry: ${STREAM_RETRY_MS}\n\n${formatSnapshotMessage()}`);
    streamClients.add(response);
    request.on('close', () => {
      streamClients.delete(response);
    });
  }

  async function handleStatic(
    urlPath: string,
    headOnly: boolean,
    response: ServerResponse,
  ): Promise<void> {
    const filePath = resolveStaticPath(options.publicDir, urlPath);
    if (filePath === undefined) {
      sendNotFound(response);
      return;
    }
    let size: number;
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) {
        sendNotFound(response);
        return;
      }
      size = stats.size;
    } catch {
      sendNotFound(response);
      return;
    }
    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': contentTypeFor(filePath),
      'Content-Length': size,
      'Cache-Control': 'no-cache',
    });
    if (headOnly) {
      response.end();
      return;
    }
    createReadStream(filePath)
      .on('error', () => response.destroy())
      .pipe(response);
  }

  function handleRequest(request: IncomingMessage, response: ServerResponse): void {
    if (!isAllowedHost(request.headers.host, options.allowedHostnames)) {
      sendPlain(response, 403, 'Forbidden: unrecognized Host header');
      return;
    }
    const method = ALLOWED_METHODS.find((allowed) => allowed === request.method);
    if (method === undefined) {
      response.setHeader('Allow', ALLOWED_METHODS.join(', '));
      sendPlain(response, 405, 'Method not allowed');
      return;
    }
    const urlPath = (request.url ?? '/').split('?')[0] ?? '/';
    if (urlPath === CONFIG_PATH) {
      response.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': JSON_CONTENT,
        'Cache-Control': 'no-store',
      });
      response.end(method === 'HEAD' ? undefined : JSON.stringify(options.config));
      return;
    }
    if (urlPath === STREAM_PATH && method === 'GET') {
      handleStream(request, response);
      return;
    }
    void handleStatic(urlPath, method === 'HEAD', response);
  }

  const server: Server = createServer(handleRequest);

  return {
    listen(port: number, bindAddress: string): Promise<number> {
      return new Promise((resolvePort, reject) => {
        server.once('error', reject);
        server.listen(port, bindAddress, () => {
          server.off('error', reject);
          snapshotTimer = setInterval(broadcastSnapshot, snapshotIntervalMs);
          const address = server.address();
          resolvePort(address !== null && typeof address === 'object' ? address.port : port);
        });
      });
    },
    close(): Promise<void> {
      if (snapshotTimer !== undefined) {
        clearInterval(snapshotTimer);
        snapshotTimer = undefined;
      }
      for (const client of streamClients) {
        client.end();
      }
      streamClients.clear();
      return new Promise((resolveClosed) => {
        server.close(() => resolveClosed());
        server.closeAllConnections();
      });
    },
  };
}
