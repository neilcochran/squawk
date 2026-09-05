import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createJsonAircraftFeed } from './json-source.js';
import { collectEventDetails } from './test-utils.js';
import type { AircraftUpdateEventDetail, ConnectionStateEventDetail } from './types/index.js';

const URL = 'http://192.168.1.50:8080/data/aircraft.json';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('start', () => {
  it('polls immediately rather than waiting for the first interval tick', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock });

    feed.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ signal: expect.anything() }),
    );
    feed.stop();
  });

  it('polls again after pollIntervalMs elapses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock, pollIntervalMs: 500 });

    feed.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    feed.stop();
  });

  it('defaults pollIntervalMs to 1000', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock });

    feed.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    feed.stop();
  });

  it('is a no-op when already started', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock, pollIntervalMs: 500 });

    feed.start();
    feed.start();
    await vi.advanceTimersByTimeAsync(500);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    feed.stop();
  });

  it('ingests mapped aircraft from a successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [{ hex: 'a0b1c2' }] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock });
    const newEvents = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    feed.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(newEvents).toHaveLength(1);
    expect(newEvents[0]?.aircraft.icaoHex).toBe('A0B1C2');
    feed.stop();
  });

  it('swallows a non-ok response and keeps polling on the next tick', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValue(jsonResponse({ aircraft: [{ hex: 'a0b1c2' }] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock, pollIntervalMs: 500 });
    const newEvents = collectEventDetails<AircraftUpdateEventDetail>(feed, 'aircraft:new');

    feed.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(newEvents).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(500);
    expect(newEvents).toHaveLength(1);
    feed.stop();
  });

  it('swallows a rejected fetch and keeps polling on the next tick', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(jsonResponse({ aircraft: [] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock, pollIntervalMs: 500 });

    feed.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(500);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    feed.stop();
  });
});

describe('stop', () => {
  it('stops further polling', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock, pollIntervalMs: 500 });

    feed.start();
    await vi.advanceTimersByTimeAsync(0);
    feed.stop();
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when already stopped', () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock });

    expect(() => feed.stop()).not.toThrow();
  });

  it('clears tracked aircraft', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [{ hex: 'a0b1c2' }] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock });

    feed.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.getAllAircraft()).toHaveLength(1);

    feed.stop();
    expect(feed.getAllAircraft()).toHaveLength(0);
  });
});

describe('connection state', () => {
  it('defaults to reconnecting before the first poll', () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock });
    expect(feed.getConnectionState()).toBe('reconnecting');
  });

  it('dispatches connection:connect once a poll succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ aircraft: [] }));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock });
    const events = collectEventDetails<ConnectionStateEventDetail>(feed, 'connection:connect');

    feed.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(feed.getConnectionState()).toBe('connected');
    expect(events).toHaveLength(1);
    expect(events[0]?.state).toBe('connected');
    feed.stop();
  });

  it('dispatches connection:disconnect when a poll returns a non-ok response after a successful one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ aircraft: [] }))
      .mockResolvedValue(jsonResponse({}, 503));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock, pollIntervalMs: 500 });
    const events = collectEventDetails<ConnectionStateEventDetail>(feed, 'connection:disconnect');

    feed.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.getConnectionState()).toBe('connected');

    await vi.advanceTimersByTimeAsync(500);
    expect(feed.getConnectionState()).toBe('reconnecting');
    expect(events).toHaveLength(1);
    expect(events[0]?.state).toBe('reconnecting');
    feed.stop();
  });

  it('dispatches connection:disconnect when a poll rejects after a successful one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ aircraft: [] }))
      .mockRejectedValue(new Error('network down'));
    const feed = createJsonAircraftFeed({ url: URL, fetch: fetchMock, pollIntervalMs: 500 });
    const events = collectEventDetails<ConnectionStateEventDetail>(feed, 'connection:disconnect');

    feed.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(feed.getConnectionState()).toBe('connected');

    await vi.advanceTimersByTimeAsync(500);
    expect(feed.getConnectionState()).toBe('reconnecting');
    expect(events).toHaveLength(1);
    feed.stop();
  });
});
