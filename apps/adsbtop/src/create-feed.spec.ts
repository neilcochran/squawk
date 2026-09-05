import { describe, expect, it, vi } from 'vitest';

import type { CliOptions } from './cli-args.js';
import { buildFeed, buildJsonUrl } from './create-feed.js';
import type { FeedFactories } from './create-feed.js';

function makeCliOptions(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    help: false,
    source: 'sbs',
    host: 'localhost',
    port: 30003,
    url: undefined,
    location: undefined,
    ...overrides,
  };
}

function makeFakeFactories(): FeedFactories & {
  createJsonAircraftFeed: ReturnType<typeof vi.fn>;
  createSbsAircraftFeed: ReturnType<typeof vi.fn>;
  createBeastAircraftFeed: ReturnType<typeof vi.fn>;
} {
  return {
    createJsonAircraftFeed: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    createSbsAircraftFeed: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    createBeastAircraftFeed: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  } as unknown as FeedFactories & {
    createJsonAircraftFeed: ReturnType<typeof vi.fn>;
    createSbsAircraftFeed: ReturnType<typeof vi.fn>;
    createBeastAircraftFeed: ReturnType<typeof vi.fn>;
  };
}

describe('buildJsonUrl', () => {
  it('assembles the standard aircraft.json path from host and port', () => {
    expect(buildJsonUrl('192.168.1.50', 8080)).toBe('http://192.168.1.50:8080/data/aircraft.json');
  });
});

describe('buildFeed', () => {
  it('builds a json feed from --host/--port when no --url is given', () => {
    const factories = makeFakeFactories();
    buildFeed(makeCliOptions({ source: 'json', host: '192.168.1.50', port: 8080 }), factories);

    expect(factories.createJsonAircraftFeed).toHaveBeenCalledWith({
      url: 'http://192.168.1.50:8080/data/aircraft.json',
    });
    expect(factories.createSbsAircraftFeed).not.toHaveBeenCalled();
    expect(factories.createBeastAircraftFeed).not.toHaveBeenCalled();
  });

  it('prefers an explicit --url for the json source', () => {
    const factories = makeFakeFactories();
    buildFeed(
      makeCliOptions({ source: 'json', url: 'http://example.com/aircraft.json' }),
      factories,
    );

    expect(factories.createJsonAircraftFeed).toHaveBeenCalledWith({
      url: 'http://example.com/aircraft.json',
    });
  });

  it('builds an sbs feed with host/port', () => {
    const factories = makeFakeFactories();
    buildFeed(makeCliOptions({ source: 'sbs', host: '192.168.1.50', port: 30003 }), factories);

    expect(factories.createSbsAircraftFeed).toHaveBeenCalledWith({
      host: '192.168.1.50',
      port: 30003,
    });
  });

  it('builds a beast feed with host/port', () => {
    const factories = makeFakeFactories();
    buildFeed(makeCliOptions({ source: 'beast', host: '192.168.1.50', port: 30005 }), factories);

    expect(factories.createBeastAircraftFeed).toHaveBeenCalledWith({
      host: '192.168.1.50',
      port: 30005,
    });
  });

  it('passes the configured location as receiverPosition for the beast source', () => {
    const factories = makeFakeFactories();
    buildFeed(
      makeCliOptions({
        source: 'beast',
        host: '192.168.1.50',
        port: 30005,
        location: { lat: 40.6413, lon: -73.7781 },
      }),
      factories,
    );

    expect(factories.createBeastAircraftFeed).toHaveBeenCalledWith({
      host: '192.168.1.50',
      port: 30005,
      receiverPosition: { lat: 40.6413, lon: -73.7781 },
    });
  });

  it('omits receiverPosition for the beast source when no location is configured', () => {
    const factories = makeFakeFactories();
    buildFeed(makeCliOptions({ source: 'beast', host: '192.168.1.50', port: 30005 }), factories);

    expect(factories.createBeastAircraftFeed).toHaveBeenCalledWith({
      host: '192.168.1.50',
      port: 30005,
    });
  });

  it('does not apply the configured location to the json or sbs sources', () => {
    const factories = makeFakeFactories();
    buildFeed(
      makeCliOptions({
        source: 'sbs',
        host: '192.168.1.50',
        port: 30003,
        location: { lat: 40.6413, lon: -73.7781 },
      }),
      factories,
    );

    expect(factories.createSbsAircraftFeed).toHaveBeenCalledWith({
      host: '192.168.1.50',
      port: 30003,
    });
  });
});
