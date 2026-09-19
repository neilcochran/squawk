import { describe, expect, it, vi } from 'vitest';

import type { AircraftFeed } from '@squawk/adsb-feed';

import type { CliOptions } from './cli-args.js';
import { buildFeed, describeStation } from './create-feed.js';
import type { FeedFactories } from './create-feed.js';

function makeCliOptions(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    help: false,
    source: 'beast',
    host: '192.168.1.50',
    port: 30005,
    url: undefined,
    location: { lat: 40.6413, lon: -73.7781 },
    rangeNm: 60,
    listenPort: 8090,
    bindAddress: '127.0.0.1',
    replayPath: undefined,
    staleAfterMs: 60_000,
    ...overrides,
  };
}

function makeFactories(): {
  createLiveFeed: ReturnType<typeof vi.fn<FeedFactories['createLiveFeed']>>;
  createReplayFeed: ReturnType<typeof vi.fn<FeedFactories['createReplayFeed']>>;
} {
  return {
    createLiveFeed: vi.fn<FeedFactories['createLiveFeed']>(),
    createReplayFeed: vi.fn<FeedFactories['createReplayFeed']>(),
  };
}

function makeFeed(): AircraftFeed {
  return Object.assign(new EventTarget(), {
    start: vi.fn(),
    stop: vi.fn(),
    getAircraft: vi.fn(() => undefined),
    getAllAircraft: vi.fn(() => []),
    getPositionHistory: vi.fn(() => []),
    getConnectionState: vi.fn(() => 'reconnecting' as const),
  });
}

describe('buildFeed', () => {
  it('builds a live feed with the connection options, history bound, and receiver position', () => {
    const factories = makeFactories();
    buildFeed(makeCliOptions({ staleAfterMs: 15_000 }), factories);

    expect(factories.createLiveFeed).toHaveBeenCalledWith({
      source: 'beast',
      host: '192.168.1.50',
      port: 30005,
      staleAfterMs: 15_000,
      positionHistoryRetention: { maxAgeMs: 120_000 },
      receiverPosition: { lat: 40.6413, lon: -73.7781 },
    });
    expect(factories.createReplayFeed).not.toHaveBeenCalled();
  });

  it('passes an explicit --url through', () => {
    const factories = makeFactories();
    buildFeed(
      makeCliOptions({ source: 'json', port: 8080, url: 'http://example.com/aircraft.json' }),
      factories,
    );

    expect(factories.createLiveFeed).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'json', url: 'http://example.com/aircraft.json' }),
    );
  });

  it('builds a replay feed instead when --replay is given', () => {
    const factories = makeFactories();
    buildFeed(makeCliOptions({ replayPath: 'session.jsonl' }), factories);

    expect(factories.createLiveFeed).not.toHaveBeenCalled();
    expect(factories.createReplayFeed).toHaveBeenCalledWith({
      openLines: expect.any(Function),
      positionHistoryRetention: { maxAgeMs: 120_000 },
    });
  });

  it('returns the feed the factory created', () => {
    const feed = makeFeed();
    const factories = makeFactories();
    factories.createLiveFeed.mockReturnValue(feed);

    expect(buildFeed(makeCliOptions(), factories)).toBe(feed);
  });
});

describe('describeStation', () => {
  it('describes a socket or polled station as host:port', () => {
    expect(describeStation(makeCliOptions())).toBe('192.168.1.50:30005');
  });

  it('prefers an explicit URL', () => {
    expect(describeStation(makeCliOptions({ url: 'http://example.com/aircraft.json' }))).toBe(
      'http://example.com/aircraft.json',
    );
  });

  it("describes a replay by the recording's file name", () => {
    expect(describeStation(makeCliOptions({ replayPath: 'recordings/session.jsonl' }))).toBe(
      'session.jsonl',
    );
  });
});
