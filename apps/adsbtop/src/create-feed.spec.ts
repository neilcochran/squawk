import { describe, expect, it, vi } from 'vitest';

import type { CliOptions } from './cli-args.js';
import { buildFeed } from './create-feed.js';

function makeCliOptions(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    help: false,
    source: 'beast',
    host: 'localhost',
    port: 30005,
    url: undefined,
    location: undefined,
    columnKeys: undefined,
    filter: undefined,
    staleAfterMs: 60_000,
    watchlist: [],
    alertEmergency: false,
    bell: true,
    recordPath: undefined,
    units: 'aviation',
    ...overrides,
  };
}

describe('buildFeed', () => {
  it('returns the feed the factory created', () => {
    const feed = Object.assign(new EventTarget(), {
      start: vi.fn(),
      stop: vi.fn(),
      getAircraft: vi.fn(() => undefined),
      getAllAircraft: vi.fn(() => []),
      getPositionHistory: vi.fn(() => []),
      getConnectionState: vi.fn(() => 'reconnecting' as const),
    });

    expect(buildFeed(makeCliOptions(), () => feed)).toBe(feed);
  });

  it('passes the source, connection options, stale threshold, and history bound for every source', () => {
    for (const [source, port] of [
      ['json', 8080],
      ['sbs', 30003],
      ['beast', 30005],
    ] as const) {
      const createFeed = vi.fn();
      buildFeed(
        makeCliOptions({ source, host: '192.168.1.50', port, staleAfterMs: 15_000 }),
        createFeed,
      );

      expect(createFeed).toHaveBeenCalledWith({
        source,
        host: '192.168.1.50',
        port,
        staleAfterMs: 15_000,
        positionHistoryRetention: { maxEntries: 300 },
      });
    }
  });

  it('passes an explicit --url through', () => {
    const createFeed = vi.fn();
    buildFeed(
      makeCliOptions({ source: 'json', port: 8080, url: 'http://example.com/aircraft.json' }),
      createFeed,
    );

    expect(createFeed).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://example.com/aircraft.json' }),
    );
  });

  it('passes the configured location as receiverPosition', () => {
    const createFeed = vi.fn();
    buildFeed(makeCliOptions({ location: { lat: 40.6413, lon: -73.7781 } }), createFeed);

    expect(createFeed).toHaveBeenCalledWith(
      expect.objectContaining({ receiverPosition: { lat: 40.6413, lon: -73.7781 } }),
    );
  });
});
