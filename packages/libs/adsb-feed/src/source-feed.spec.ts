import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBeastAircraftFeed } from './beast-source.js';
import { DEFAULT_PORT_BY_SOURCE } from './default-ports.js';
import { createJsonAircraftFeed } from './json-source.js';
import { createSbsAircraftFeed } from './sbs-source.js';
import { createAircraftFeedForSource } from './source-feed.js';
import type { AircraftFeed } from './types/index.js';

vi.mock('./json-source.js', () => ({ createJsonAircraftFeed: vi.fn() }));
vi.mock('./sbs-source.js', () => ({ createSbsAircraftFeed: vi.fn() }));
vi.mock('./beast-source.js', () => ({ createBeastAircraftFeed: vi.fn() }));

const jsonFactory = vi.mocked(createJsonAircraftFeed);
const sbsFactory = vi.mocked(createSbsAircraftFeed);
const beastFactory = vi.mocked(createBeastAircraftFeed);

function makeFakeFeed(): AircraftFeed {
  return Object.assign(new EventTarget(), {
    start: vi.fn(),
    stop: vi.fn(),
    getAircraft: vi.fn(() => undefined),
    getAllAircraft: vi.fn(() => []),
    getPositionHistory: vi.fn(() => []),
    getConnectionState: vi.fn(() => 'reconnecting' as const),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DEFAULT_PORT_BY_SOURCE', () => {
  it("matches dump1090-fa's own default ports", () => {
    expect(DEFAULT_PORT_BY_SOURCE).toEqual({ json: 8080, sbs: 30003, beast: 30005 });
  });
});

describe('createAircraftFeedForSource', () => {
  it('returns the feed the selected source factory created', () => {
    const feed = makeFakeFeed();
    sbsFactory.mockReturnValue(feed);

    expect(createAircraftFeedForSource({ source: 'sbs', host: 'localhost' })).toBe(feed);
  });

  it('only calls the factory for the selected source', () => {
    createAircraftFeedForSource({ source: 'json', host: 'localhost' });

    expect(jsonFactory).toHaveBeenCalledTimes(1);
    expect(sbsFactory).not.toHaveBeenCalled();
    expect(beastFactory).not.toHaveBeenCalled();
  });

  describe('json source', () => {
    it('assembles the standard aircraft.json URL from host and the default port', () => {
      createAircraftFeedForSource({ source: 'json', host: '192.168.1.50' });

      expect(jsonFactory).toHaveBeenCalledWith({
        url: 'http://192.168.1.50:8080/data/aircraft.json',
      });
    });

    it('uses an explicit port in the assembled URL', () => {
      createAircraftFeedForSource({ source: 'json', host: '192.168.1.50', port: 8888 });

      expect(jsonFactory).toHaveBeenCalledWith({
        url: 'http://192.168.1.50:8888/data/aircraft.json',
      });
    });

    it('brackets an IPv6 literal host', () => {
      createAircraftFeedForSource({ source: 'json', host: 'fe80::1' });

      expect(jsonFactory).toHaveBeenCalledWith({
        url: 'http://[fe80::1]:8080/data/aircraft.json',
      });
    });

    it('leaves an already-bracketed IPv6 host as-is', () => {
      createAircraftFeedForSource({ source: 'json', host: '[fe80::1]' });

      expect(jsonFactory).toHaveBeenCalledWith({
        url: 'http://[fe80::1]:8080/data/aircraft.json',
      });
    });

    it('prefers an explicit url over host/port', () => {
      createAircraftFeedForSource({
        source: 'json',
        host: '192.168.1.50',
        port: 8888,
        url: 'http://example.com/aircraft.json',
      });

      expect(jsonFactory).toHaveBeenCalledWith({ url: 'http://example.com/aircraft.json' });
    });

    it('passes pollIntervalMs and fetch through, and ignores socket-only options', () => {
      const fetchOverride = vi.fn();
      createAircraftFeedForSource({
        source: 'json',
        host: 'localhost',
        pollIntervalMs: 2500,
        fetch: fetchOverride,
        reconnectDelayMs: 100,
        receiverPosition: { lat: 40.6413, lon: -73.7781 },
      });

      expect(jsonFactory).toHaveBeenCalledWith({
        url: 'http://localhost:8080/data/aircraft.json',
        pollIntervalMs: 2500,
        fetch: fetchOverride,
      });
    });
  });

  describe('sbs source', () => {
    it('passes host and the default port', () => {
      createAircraftFeedForSource({ source: 'sbs', host: '192.168.1.50' });

      expect(sbsFactory).toHaveBeenCalledWith({ host: '192.168.1.50', port: 30003 });
    });

    it('passes an explicit port and reconnectDelayMs, and ignores options for other sources', () => {
      createAircraftFeedForSource({
        source: 'sbs',
        host: '192.168.1.50',
        port: 31003,
        reconnectDelayMs: 100,
        url: 'http://example.com/aircraft.json',
        pollIntervalMs: 2500,
        receiverPosition: { lat: 40.6413, lon: -73.7781 },
      });

      expect(sbsFactory).toHaveBeenCalledWith({
        host: '192.168.1.50',
        port: 31003,
        reconnectDelayMs: 100,
      });
    });
  });

  describe('beast source', () => {
    it('passes host and the default port', () => {
      createAircraftFeedForSource({ source: 'beast', host: '192.168.1.50' });

      expect(beastFactory).toHaveBeenCalledWith({ host: '192.168.1.50', port: 30005 });
    });

    it('passes receiverPosition and reconnectDelayMs, and ignores json-only options', () => {
      createAircraftFeedForSource({
        source: 'beast',
        host: '192.168.1.50',
        port: 31005,
        reconnectDelayMs: 100,
        receiverPosition: { lat: 40.6413, lon: -73.7781 },
        url: 'http://example.com/aircraft.json',
        pollIntervalMs: 2500,
      });

      expect(beastFactory).toHaveBeenCalledWith({
        host: '192.168.1.50',
        port: 31005,
        reconnectDelayMs: 100,
        receiverPosition: { lat: 40.6413, lon: -73.7781 },
      });
    });
  });

  it('passes the shared tracker options through to every source', () => {
    const trackerOptions = {
      staleAfterMs: 15_000,
      sweepIntervalMs: 500,
      positionHistoryRetention: { maxEntries: 300 },
    };
    for (const [source, factory] of [
      ['json', jsonFactory],
      ['sbs', sbsFactory],
      ['beast', beastFactory],
    ] as const) {
      createAircraftFeedForSource({ source, host: 'localhost', ...trackerOptions });

      expect(factory).toHaveBeenCalledWith(expect.objectContaining(trackerOptions));
    }
  });
});
