import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import type { AircraftFeed } from '@squawk/adsb-feed';

import { USAGE } from './cli-args.js';
import type { ScopeServer, ScopeServerOptions } from './http-server.js';
import { DEFAULT_RUN_DEPENDENCIES, EXIT_FAILURE, EXIT_OK, formatScopeUrl, run } from './run.js';
import type { RunDependencies, RunResult, RunningScope } from './run.js';
import type { VideoMapProvider } from './video-map/provider.js';

const LOCATION = ['--lat', '40.6413', '--lon', '-73.7781'];

interface Harness {
  dependencies: RunDependencies;
  feed: AircraftFeed & { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
  server: { listen: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  serverOptions: ScopeServerOptions[];
  videoMaps: { preload: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
  out: string[];
  err: string[];
  io: { stdout(text: string): void; stderr(text: string): void };
}

function makeHarness(overrides: Partial<RunDependencies> = {}): Harness {
  const feed = Object.assign(new EventTarget(), {
    start: vi.fn(),
    stop: vi.fn(),
    getAircraft: vi.fn(() => undefined),
    getAllAircraft: vi.fn(() => []),
    getPositionHistory: vi.fn(() => []),
    getConnectionState: vi.fn(() => 'reconnecting' as const),
  });
  const server = {
    listen: vi.fn((port: number) => Promise.resolve(port)),
    close: vi.fn(() => Promise.resolve()),
  };
  const serverOptions: ScopeServerOptions[] = [];
  const videoMaps = {
    preload: vi.fn(() => Promise.resolve()),
    get: vi.fn((rangeNm: number) => Promise.resolve({ rangeNm, points: [], lines: [] })),
  };
  const out: string[] = [];
  const err: string[] = [];
  return {
    feed,
    server,
    serverOptions,
    videoMaps,
    out,
    err,
    io: { stdout: (text) => out.push(text), stderr: (text) => err.push(text) },
    dependencies: {
      buildFeed: vi.fn(() => feed),
      createScopeServer: vi.fn((options: ScopeServerOptions): ScopeServer => {
        serverOptions.push(options);
        return server;
      }),
      createVideoMapProvider: vi.fn((): VideoMapProvider => videoMaps),
      canRead: vi.fn(() => Promise.resolve(true)),
      machineHostname: () => 'MyPC',
      publicDir: '/ui',
      ...overrides,
    },
  };
}

function expectRunning(result: RunResult): RunningScope {
  if (!('running' in result)) {
    throw new Error(`expected a running scope, got exit code ${result.exitCode}`);
  }
  return result.running;
}

describe('formatScopeUrl', () => {
  it('uses the bind address as the host', () => {
    expect(formatScopeUrl('127.0.0.1', 8090)).toBe('http://127.0.0.1:8090');
    expect(formatScopeUrl('192.168.1.20', 9000)).toBe('http://192.168.1.20:9000');
  });

  it('shows a wildcard bind address as localhost', () => {
    expect(formatScopeUrl('0.0.0.0', 8090)).toBe('http://localhost:8090');
    expect(formatScopeUrl('::', 8090)).toBe('http://localhost:8090');
  });

  it('brackets an IPv6 literal', () => {
    expect(formatScopeUrl('::1', 8090)).toBe('http://[::1]:8090');
  });
});

describe('DEFAULT_RUN_DEPENDENCIES', () => {
  it('can tell a readable file from a missing one', async () => {
    const thisFile = fileURLToPath(import.meta.url);

    await expect(DEFAULT_RUN_DEPENDENCIES.canRead(thisFile)).resolves.toBe(true);
    await expect(DEFAULT_RUN_DEPENDENCIES.canRead(`${thisFile}.missing`)).resolves.toBe(false);
  });

  it('serves the UI from the public directory beside the compiled server', () => {
    expect(basename(DEFAULT_RUN_DEPENDENCIES.publicDir)).toBe('public');
  });
});

describe('run', () => {
  it('reports an argument error with usage and fails without starting anything', async () => {
    const harness = makeHarness();

    const result = await run(['--nope'], harness.io, harness.dependencies);

    expect(result).toEqual({ exitCode: EXIT_FAILURE });
    expect(harness.err.join('')).toContain('--nope');
    expect(harness.err.join('')).toContain(USAGE);
    expect(harness.out).toEqual([]);
    expect(harness.dependencies.buildFeed).not.toHaveBeenCalled();
  });

  it('prints usage for --help and succeeds without starting anything', async () => {
    const harness = makeHarness();

    const result = await run(['--help'], harness.io, harness.dependencies);

    expect(result).toEqual({ exitCode: EXIT_OK });
    expect(harness.out).toEqual([USAGE]);
    expect(harness.err).toEqual([]);
    expect(harness.dependencies.createScopeServer).not.toHaveBeenCalled();
  });

  it('fails before building anything when the replay file cannot be read', async () => {
    const harness = makeHarness({ canRead: vi.fn(() => Promise.resolve(false)) });

    const result = await run(
      [...LOCATION, '--replay', 'missing.jsonl'],
      harness.io,
      harness.dependencies,
    );

    expect(result).toEqual({ exitCode: EXIT_FAILURE });
    expect(harness.err.join('')).toContain('Cannot read --replay file "missing.jsonl"');
    expect(harness.dependencies.buildFeed).not.toHaveBeenCalled();
  });

  it('does not check for a recording when running live', async () => {
    const harness = makeHarness();

    await run(LOCATION, harness.io, harness.dependencies);

    expect(harness.dependencies.canRead).not.toHaveBeenCalled();
  });

  it('fails without starting the feed when the port cannot be bound', async () => {
    const harness = makeHarness();
    harness.server.listen.mockRejectedValue(new Error('listen EADDRINUSE'));

    const result = await run(LOCATION, harness.io, harness.dependencies);

    expect(result).toEqual({ exitCode: EXIT_FAILURE });
    expect(harness.err.join('')).toContain(
      'Could not serve the scope on 127.0.0.1:8090 - listen EADDRINUSE',
    );
    expect(harness.feed.start).not.toHaveBeenCalled();
  });

  it('reports a non-Error listen failure as text', async () => {
    const harness = makeHarness();
    harness.server.listen.mockRejectedValue('port is busy');

    await run(LOCATION, harness.io, harness.dependencies);

    expect(harness.err.join('')).toContain('- port is busy');
  });

  it('starts the server and the feed for a live station and prints where to look', async () => {
    const harness = makeHarness();

    const result = await run(
      [...LOCATION, '--host', '192.168.1.50', '--range', '40', '--mode', 'analog'],
      harness.io,
      harness.dependencies,
    );

    const running = expectRunning(result);
    expect(running.url).toBe('http://127.0.0.1:8090');
    expect(harness.server.listen).toHaveBeenCalledWith(8090, '127.0.0.1');
    expect(harness.feed.start).toHaveBeenCalledTimes(1);
    expect(harness.out).toEqual(['adsbscope: 192.168.1.50:30005 -> http://127.0.0.1:8090\n']);
    expect(harness.serverOptions[0]).toMatchObject({
      feed: harness.feed,
      config: {
        receiver: { lat: 40.6413, lon: -73.7781 },
        source: 'beast',
        station: '192.168.1.50:30005',
        mode: 'analog',
        rangeNm: 40,
      },
      publicDir: '/ui',
      allowedHostnames: ['localhost', 'mypc', 'mypc.local'],
    });
  });

  it('centers the video maps on the receiver, serves them from the scope server, and warms them up', async () => {
    const harness = makeHarness();

    await run(LOCATION, harness.io, harness.dependencies);

    expect(harness.dependencies.createVideoMapProvider).toHaveBeenCalledWith({
      receiver: { lat: 40.6413, lon: -73.7781 },
    });
    expect(harness.videoMaps.preload).toHaveBeenCalledTimes(1);
    await expect(harness.serverOptions[0]?.getVideoMap(60)).resolves.toMatchObject({ rangeNm: 60 });
    expect(harness.videoMaps.get).toHaveBeenCalledWith(60);
  });

  it('starts anyway when warming the video maps fails', async () => {
    const harness = makeHarness();
    harness.videoMaps.preload.mockRejectedValue(new Error('snapshot unreadable'));

    const result = await run(LOCATION, harness.io, harness.dependencies);

    expectRunning(result);
    expect(harness.err).toEqual([]);
  });

  it('reports the port the server actually bound', async () => {
    const harness = makeHarness();
    harness.server.listen.mockResolvedValue(51234);

    const running = expectRunning(
      await run([...LOCATION, '--listen-port', '1'], harness.io, harness.dependencies),
    );

    expect(running.url).toBe('http://127.0.0.1:51234');
  });

  it('describes a replay as the replay source', async () => {
    const harness = makeHarness();

    await run(
      [...LOCATION, '--replay', 'recordings/session.jsonl'],
      harness.io,
      harness.dependencies,
    );

    expect(harness.dependencies.canRead).toHaveBeenCalledWith('recordings/session.jsonl');
    expect(harness.serverOptions[0]?.config).toMatchObject({
      source: 'replay',
      station: 'session.jsonl',
    });
  });

  it('prints an exposure reminder when serving beyond loopback', async () => {
    const harness = makeHarness();

    await run([...LOCATION, '--bind', '0.0.0.0'], harness.io, harness.dependencies);

    expect(harness.out[0]).toContain('http://localhost:8090');
    expect(harness.out[1]).toContain('Serving beyond loopback');
  });

  it('stops the feed and closes the server when the running scope is stopped', async () => {
    const harness = makeHarness();
    const running = expectRunning(await run(LOCATION, harness.io, harness.dependencies));

    await running.stop();

    expect(harness.feed.stop).toHaveBeenCalledTimes(1);
    expect(harness.server.close).toHaveBeenCalledTimes(1);
  });
});
