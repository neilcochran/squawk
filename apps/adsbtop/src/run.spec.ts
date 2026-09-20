import { describe, expect, it, vi } from 'vitest';

import type { AircraftFeed } from '@squawk/adsb-feed';

import { USAGE } from './cli-args.js';
import { DEFAULT_RUN_DEPENDENCIES, EXIT_FAILURE, EXIT_OK, run } from './run.js';
import type { RunDependencies } from './run.js';

interface Harness {
  /** Collaborators to pass to `run`, with a fake feed factory. */
  dependencies: RunDependencies;
  /** The feed the fake factory returns. */
  feed: AircraftFeed;
  /** Everything written to stdout, in order. */
  out: string[];
  /** Everything written to stderr, in order. */
  err: string[];
  /** The `CliIo` that collects into `out` and `err`. */
  io: { stdout(text: string): void; stderr(text: string): void };
}

function makeHarness(): Harness {
  const feed: AircraftFeed = Object.assign(new EventTarget(), {
    start: vi.fn(),
    stop: vi.fn(),
    getAircraft: vi.fn(() => undefined),
    getAllAircraft: vi.fn(() => []),
    getPositionHistory: vi.fn(() => []),
    getConnectionState: vi.fn(() => 'reconnecting' as const),
  });
  const out: string[] = [];
  const err: string[] = [];
  return {
    feed,
    out,
    err,
    io: { stdout: (text) => out.push(text), stderr: (text) => err.push(text) },
    dependencies: { buildFeed: vi.fn(() => feed) },
  };
}

describe('DEFAULT_RUN_DEPENDENCIES', () => {
  it('uses the real feed factory', () => {
    expect(DEFAULT_RUN_DEPENDENCIES.buildFeed).toBeTypeOf('function');
  });
});

describe('run', () => {
  it('reports an argument error with usage and fails without building a feed', () => {
    const harness = makeHarness();

    const result = run(['--nope'], harness.io, harness.dependencies);

    expect(result).toEqual({ exitCode: EXIT_FAILURE });
    expect(harness.err.join('')).toContain('--nope');
    expect(harness.err.join('')).toContain(USAGE);
    expect(harness.out).toEqual([]);
    expect(harness.dependencies.buildFeed).not.toHaveBeenCalled();
  });

  it('prints usage for --help and succeeds without building a feed', () => {
    const harness = makeHarness();

    const result = run(['--help'], harness.io, harness.dependencies);

    expect(result).toEqual({ exitCode: EXIT_OK });
    expect(harness.out).toEqual([USAGE]);
    expect(harness.err).toEqual([]);
    expect(harness.dependencies.buildFeed).not.toHaveBeenCalled();
  });

  it('writes the error before the usage it explains', () => {
    const harness = makeHarness();

    run(['--port', 'abc'], harness.io, harness.dependencies);

    const written = harness.err.join('');
    expect(written.indexOf('--port')).toBeLessThan(written.indexOf(USAGE));
  });

  it('builds the dashboard from the parsed options for a usable command line', () => {
    const harness = makeHarness();

    const result = run(
      ['--host', 'station.local', '--lat', '43.67', '--lon', '-70.36'],
      harness.io,
      harness.dependencies,
    );

    if ('exitCode' in result) {
      throw new Error(`expected a dashboard, got exit code ${result.exitCode}`);
    }
    expect(result.dashboard.feed).toBe(harness.feed);
    expect(result.dashboard.options.host).toBe('station.local');
    expect(result.dashboard.options.location).toEqual({ lat: 43.67, lon: -70.36 });
    expect(harness.dependencies.buildFeed).toHaveBeenCalledWith(result.dashboard.options);
    expect(harness.out).toEqual([]);
    expect(harness.err).toEqual([]);
  });

  it('does not start the feed it builds, leaving that to the dashboard', () => {
    const harness = makeHarness();

    run([], harness.io, harness.dependencies);

    expect(harness.feed.start).not.toHaveBeenCalled();
  });
});
