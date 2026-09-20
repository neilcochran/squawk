import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { AircraftFeed } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import {
  createReplayAircraftFeed,
  LOOP_PAUSE_MS,
  openRecordingLines,
  parseReplayLine,
} from './replay-feed.js';
import type { ReplayFeedOptions } from './replay-feed.js';

const RECORDED_AT = 1_700_000_000_000;

function aircraftLine(
  type: 'new' | 'update',
  offsetMs: number,
  aircraft: Partial<Aircraft> & { icaoHex: string },
): string {
  const at = RECORDED_AT + offsetMs;
  return JSON.stringify({ type, at, aircraft: { lastSeenAt: at, ...aircraft } });
}

function lostLine(offsetMs: number, icaoHex: string): string {
  return JSON.stringify({
    type: 'lost',
    at: RECORDED_AT + offsetMs,
    icaoHex,
    lastAircraft: { icaoHex, lastSeenAt: RECORDED_AT },
  });
}

function linesOf(lines: string[]): () => AsyncIterable<string> {
  return async function* open(): AsyncIterable<string> {
    yield* lines;
  };
}

/** A clock that only moves when the replay waits, so timing is exact. */
function makeClock(start: number): {
  now: () => number;
  delay: (ms: number) => Promise<void>;
  waits: number[];
} {
  let current = start;
  const waits: number[] = [];
  return {
    now: () => current,
    delay: (ms: number): Promise<void> => {
      waits.push(ms);
      current += ms;
      return Promise.resolve();
    },
    waits,
  };
}

function collectEvents(feed: AircraftFeed): string[] {
  const events: string[] = [];
  for (const name of ['aircraft:new', 'aircraft:update', 'aircraft:lost']) {
    feed.addEventListener(name, (event) => {
      const detail = (event as CustomEvent<{ aircraft?: Aircraft; icaoHex?: string }>).detail;
      events.push(`${name} ${detail.aircraft?.icaoHex ?? detail.icaoHex}`);
    });
  }
  return events;
}

function finished(feed: AircraftFeed): Promise<void> {
  return new Promise((resolve) => {
    feed.addEventListener('connection:disconnect', () => resolve(), { once: true });
  });
}

async function playToEnd(options: ReplayFeedOptions): Promise<AircraftFeed> {
  const feed = createReplayAircraftFeed({ loop: false, ...options });
  const done = finished(feed);
  feed.start();
  await done;
  return feed;
}

describe('parseReplayLine', () => {
  it('parses new and update lines', () => {
    expect(parseReplayLine(aircraftLine('new', 0, { icaoHex: 'a1b2c3' }))).toEqual({
      type: 'new',
      at: RECORDED_AT,
      aircraft: { icaoHex: 'a1b2c3', lastSeenAt: RECORDED_AT },
    });
    expect(parseReplayLine(aircraftLine('update', 500, { icaoHex: 'a1b2c3' }))?.type).toBe(
      'update',
    );
  });

  it('parses a lost line', () => {
    expect(parseReplayLine(lostLine(1000, 'a1b2c3'))).toEqual({
      type: 'lost',
      at: RECORDED_AT + 1000,
      icaoHex: 'a1b2c3',
    });
  });

  it('returns undefined for anything that is not a record event', () => {
    expect(parseReplayLine('')).toBeUndefined();
    expect(parseReplayLine('   ')).toBeUndefined();
    expect(parseReplayLine('{not json')).toBeUndefined();
    expect(parseReplayLine('42')).toBeUndefined();
    expect(parseReplayLine('null')).toBeUndefined();
    expect(parseReplayLine(JSON.stringify({ type: 'new', aircraft: {} }))).toBeUndefined();
    expect(parseReplayLine(JSON.stringify({ type: 'new', at: 1, aircraft: {} }))).toBeUndefined();
    expect(parseReplayLine(JSON.stringify({ type: 'new', at: 1, aircraft: 7 }))).toBeUndefined();
    expect(parseReplayLine(JSON.stringify({ type: 'lost', at: 1 }))).toBeUndefined();
    expect(parseReplayLine(JSON.stringify({ type: 'other', at: 1 }))).toBeUndefined();
  });
});

describe('createReplayAircraftFeed', () => {
  it('replays events with the recorded timing, shifted onto the current clock', async () => {
    const clock = makeClock(5_000_000);
    const feed = createReplayAircraftFeed({
      openLines: linesOf([
        aircraftLine('new', 0, { icaoHex: 'a1b2c3' }),
        aircraftLine('update', 1500, { icaoHex: 'a1b2c3', callsign: 'UAL123' }),
        aircraftLine('update', 1500, { icaoHex: 'c0ffee' }),
        aircraftLine('update', 4000, { icaoHex: 'a1b2c3', callsign: 'UAL123' }),
      ]),
      loop: false,
      ...clock,
    });
    const seen: Aircraft[] = [];
    feed.addEventListener('aircraft:update', (event) => {
      seen.push((event as CustomEvent<{ aircraft: Aircraft }>).detail.aircraft);
    });
    const done = finished(feed);

    feed.start();
    await done;

    expect(clock.waits).toEqual([1500, 2500]);
    expect(seen[0]?.lastSeenAt).toBe(5_001_500);
    expect(seen[1]?.lastSeenAt).toBe(5_004_000);
  });

  it('decides new versus update from its own state, not the recorded type', async () => {
    const feed = createReplayAircraftFeed({
      openLines: linesOf([
        aircraftLine('update', 0, { icaoHex: 'a1b2c3' }),
        aircraftLine('new', 100, { icaoHex: 'a1b2c3' }),
      ]),
      loop: false,
      ...makeClock(0),
    });
    const events = collectEvents(feed);
    const done = finished(feed);

    feed.start();
    await done;

    expect(events.slice(0, 2)).toEqual(['aircraft:new a1b2c3', 'aircraft:update a1b2c3']);
  });

  it('drops an aircraft on a lost line and ignores one for an unknown aircraft', async () => {
    const feed = createReplayAircraftFeed({
      openLines: linesOf([
        aircraftLine('new', 0, { icaoHex: 'a1b2c3' }),
        lostLine(100, 'ffffff'),
        lostLine(200, 'a1b2c3'),
      ]),
      loop: false,
      ...makeClock(0),
    });
    const events = collectEvents(feed);
    const done = finished(feed);

    feed.start();
    await done;

    expect(events).toEqual(['aircraft:new a1b2c3', 'aircraft:lost a1b2c3']);
  });

  it('drops every remaining aircraft when the recording ends', async () => {
    const feed = createReplayAircraftFeed({
      openLines: linesOf([
        aircraftLine('new', 0, { icaoHex: 'a1b2c3' }),
        aircraftLine('new', 0, { icaoHex: 'c0ffee' }),
      ]),
      loop: false,
      ...makeClock(0),
    });
    const events = collectEvents(feed);
    const done = finished(feed);

    feed.start();
    await done;

    expect(events.slice(2)).toEqual(['aircraft:lost a1b2c3', 'aircraft:lost c0ffee']);
    expect(feed.getAllAircraft()).toEqual([]);
    expect(feed.getConnectionState()).toBe('reconnecting');
  });

  it('skips lines that are not record events', async () => {
    const feed = await playToEnd({
      openLines: linesOf(['', '{broken', aircraftLine('new', 0, { icaoHex: 'a1b2c3' })]),
      ...makeClock(0),
    });

    expect(feed.getConnectionState()).toBe('reconnecting');
  });

  it('exposes tracked aircraft and connection state while playing', async () => {
    let releaseSecondEvent: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      releaseSecondEvent = resolve;
    });
    const feed = createReplayAircraftFeed({
      openLines: linesOf([
        aircraftLine('new', 0, { icaoHex: 'a1b2c3', callsign: 'UAL123' }),
        aircraftLine('update', 1000, { icaoHex: 'a1b2c3' }),
      ]),
      loop: false,
      now: () => 0,
      delay: () => held,
    });
    const connected = new Promise<void>((resolve) => {
      feed.addEventListener('connection:connect', () => resolve(), { once: true });
    });
    const done = finished(feed);

    expect(feed.getConnectionState()).toBe('reconnecting');
    feed.start();
    await connected;
    await vi.waitFor(() => expect(feed.getAircraft('a1b2c3')?.callsign).toBe('UAL123'));

    expect(feed.getConnectionState()).toBe('connected');
    expect(feed.getAllAircraft()).toHaveLength(1);
    expect(feed.getAircraft('ffffff')).toBeUndefined();

    releaseSecondEvent();
    await done;
  });

  describe('position history', () => {
    it('records a position each time it changes', async () => {
      const recorded: number[] = [];
      const feed = createReplayAircraftFeed({
        openLines: linesOf([
          aircraftLine('new', 0, { icaoHex: 'a1b2c3', position: { lat: 40, lon: -74 } }),
          aircraftLine('update', 1000, { icaoHex: 'a1b2c3', position: { lat: 40, lon: -74 } }),
          aircraftLine('update', 2000, { icaoHex: 'a1b2c3' }),
          aircraftLine('update', 3000, { icaoHex: 'a1b2c3', position: { lat: 40.1, lon: -74 } }),
        ]),
        loop: false,
        ...makeClock(0),
      });
      feed.addEventListener('aircraft:update', () => {
        recorded.push(feed.getPositionHistory('a1b2c3').length);
      });
      const done = finished(feed);

      feed.start();
      await done;

      expect(recorded).toEqual([1, 1, 2]);
      expect(feed.getPositionHistory('a1b2c3')).toEqual([]);
    });

    it('bounds the history by entry count and by age', async () => {
      const lengths: number[] = [];
      const oldest: number[] = [];
      const lines = Array.from({ length: 6 }, (_, index) =>
        aircraftLine(index === 0 ? 'new' : 'update', index * 1000, {
          icaoHex: 'a1b2c3',
          position: { lat: 40 + index / 100, lon: -74 },
        }),
      );
      const feed = createReplayAircraftFeed({
        openLines: linesOf(lines),
        loop: false,
        positionHistoryRetention: { maxEntries: 4, maxAgeMs: 2500 },
        ...makeClock(0),
      });
      function sample(): void {
        const history = feed.getPositionHistory('a1b2c3');
        lengths.push(history.length);
        oldest.push(history[0]?.recordedAt ?? -1);
      }
      feed.addEventListener('aircraft:new', sample);
      feed.addEventListener('aircraft:update', sample);
      const done = finished(feed);

      feed.start();
      await done;

      expect(lengths).toEqual([1, 2, 3, 3, 3, 3]);
      expect(oldest).toEqual([0, 0, 0, 1000, 2000, 3000]);
    });

    it('bounds the history by entry count alone', async () => {
      const lengths: number[] = [];
      const lines = Array.from({ length: 4 }, (_, index) =>
        aircraftLine('update', index * 1000, {
          icaoHex: 'a1b2c3',
          position: { lat: 40 + index / 100, lon: -74 },
        }),
      );
      const feed = createReplayAircraftFeed({
        openLines: linesOf(lines),
        loop: false,
        positionHistoryRetention: { maxEntries: 2 },
        ...makeClock(0),
      });
      feed.addEventListener('aircraft:update', () => {
        lengths.push(feed.getPositionHistory('a1b2c3').length);
      });
      const done = finished(feed);

      feed.start();
      await done;

      expect(lengths).toEqual([2, 2, 2]);
    });
  });

  describe('looping', () => {
    it('starts over, after a pause, when the recording ends', async () => {
      let passes = 0;
      const pauses: number[] = [];
      const lines = [aircraftLine('new', 0, { icaoHex: 'a1b2c3' })];
      const feed = createReplayAircraftFeed({
        openLines: () => {
          passes++;
          return linesOf(lines)();
        },
        now: () => 0,
        delay: (ms: number): Promise<void> => {
          pauses.push(ms);
          return new Promise((resolve) => setTimeout(resolve, 0));
        },
      });
      const events = collectEvents(feed);

      feed.start();
      await vi.waitFor(() => expect(passes).toBeGreaterThanOrEqual(3));
      feed.stop();

      expect(pauses.slice(0, 2)).toEqual([LOOP_PAUSE_MS, LOOP_PAUSE_MS]);

      expect(events.slice(0, 4)).toEqual([
        'aircraft:new a1b2c3',
        'aircraft:lost a1b2c3',
        'aircraft:new a1b2c3',
        'aircraft:lost a1b2c3',
      ]);
    });

    it('does not spin on a recording with no events', async () => {
      const openLines = vi.fn(linesOf(['', 'not json']));
      const feed = createReplayAircraftFeed({ openLines, ...makeClock(0) });
      const stillReconnecting = new Promise<void>((resolve) => setTimeout(resolve, 20));

      feed.start();
      await stillReconnecting;

      expect(openLines).toHaveBeenCalledTimes(1);
      expect(feed.getConnectionState()).toBe('reconnecting');
    });
  });

  describe('start and stop', () => {
    it('ignores a second start while running and a stop while stopped', async () => {
      const openLines = vi.fn(linesOf([aircraftLine('new', 0, { icaoHex: 'a1b2c3' })]));
      const feed = createReplayAircraftFeed({ openLines, loop: false, ...makeClock(0) });
      const done = finished(feed);

      feed.stop();
      feed.start();
      feed.start();
      await done;

      expect(openLines).toHaveBeenCalledTimes(1);
    });

    it('abandons the pass in progress and clears state on stop', async () => {
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const feed = createReplayAircraftFeed({
        openLines: linesOf([
          aircraftLine('new', 0, { icaoHex: 'a1b2c3' }),
          aircraftLine('new', 1000, { icaoHex: 'c0ffee' }),
        ]),
        loop: false,
        now: () => 0,
        delay: () => held,
      });
      const events = collectEvents(feed);

      feed.start();
      await vi.waitFor(() => expect(feed.getAllAircraft()).toHaveLength(1));
      feed.stop();
      release();
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      expect(events).toEqual(['aircraft:new a1b2c3']);
      expect(feed.getAllAircraft()).toEqual([]);
      expect(feed.getConnectionState()).toBe('reconnecting');
    });

    it('aborts the wait in progress on stop, so no timer outlives the feed', async () => {
      const signals: AbortSignal[] = [];
      const feed = createReplayAircraftFeed({
        openLines: linesOf([
          aircraftLine('new', 0, { icaoHex: 'a1b2c3' }),
          aircraftLine('update', 3_600_000, { icaoHex: 'a1b2c3' }),
        ]),
        loop: false,
        now: () => 0,
        delay: (_ms: number, signal: AbortSignal): Promise<void> => {
          signals.push(signal);
          return new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
          });
        },
      });

      feed.start();
      await vi.waitFor(() => expect(signals).toHaveLength(1));
      expect(signals[0]?.aborted).toBe(false);
      feed.stop();

      expect(signals[0]?.aborted).toBe(true);
      expect(feed.getConnectionState()).toBe('reconnecting');
    });

    it('aborts the default timer on stop without an unhandled rejection', async () => {
      const feed = createReplayAircraftFeed({
        openLines: linesOf([
          aircraftLine('new', 0, { icaoHex: 'a1b2c3' }),
          aircraftLine('update', 3_600_000, { icaoHex: 'a1b2c3' }),
        ]),
        loop: false,
      });

      feed.start();
      await vi.waitFor(() => expect(feed.getAllAircraft()).toHaveLength(1));
      feed.stop();
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      expect(feed.getAllAircraft()).toEqual([]);
    });

    it('gives each start a fresh signal, so a restarted replay can wait again', async () => {
      const signals: AbortSignal[] = [];
      const feed = createReplayAircraftFeed({
        openLines: linesOf([
          aircraftLine('new', 0, { icaoHex: 'a1b2c3' }),
          aircraftLine('update', 1000, { icaoHex: 'a1b2c3' }),
        ]),
        loop: false,
        now: () => 0,
        delay: (_ms: number, signal: AbortSignal): Promise<void> => {
          signals.push(signal);
          return new Promise(() => undefined);
        },
      });

      feed.start();
      await vi.waitFor(() => expect(signals).toHaveLength(1));
      feed.stop();
      feed.start();
      await vi.waitFor(() => expect(signals).toHaveLength(2));

      expect(signals[0]?.aborted).toBe(true);
      expect(signals[1]?.aborted).toBe(false);
      feed.stop();
    });

    it('stops reading lines once stopped between events', async () => {
      let yielded = 0;
      const feedRef: { current: AircraftFeed | undefined } = { current: undefined };
      async function* open(): AsyncIterable<string> {
        for (let index = 0; index < 5; index++) {
          yielded++;
          if (index === 1) {
            feedRef.current?.stop();
          }
          yield aircraftLine('update', index, { icaoHex: 'a1b2c3' });
        }
      }
      const feed = createReplayAircraftFeed({ openLines: open, loop: false, ...makeClock(0) });
      feedRef.current = feed;

      feed.start();
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      expect(yielded).toBe(2);
    });

    it('can be started again after a stop', async () => {
      const lines = [aircraftLine('new', 0, { icaoHex: 'a1b2c3' })];
      const feed = createReplayAircraftFeed({
        openLines: linesOf(lines),
        loop: false,
        ...makeClock(0),
      });
      const events = collectEvents(feed);

      const firstPass = finished(feed);
      feed.start();
      await firstPass;
      const secondPass = finished(feed);
      feed.start();
      await secondPass;

      expect(events.filter((event) => event === 'aircraft:new a1b2c3')).toHaveLength(2);
    });
  });

  it('ends the replay when the recording cannot be read', async () => {
    const feed = createReplayAircraftFeed({
      openLines: openRecordingLines(join(tmpdir(), 'adsbscope-missing', 'nope.jsonl')),
    });

    feed.start();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(feed.getConnectionState()).toBe('reconnecting');
    expect(feed.getAllAircraft()).toEqual([]);
  });
});

describe('openRecordingLines', () => {
  it('yields the lines of a recording on disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'adsbscope-replay-'));
    const path = join(dir, 'session.jsonl');
    await writeFile(path, 'first\r\nsecond\nthird');
    const lines: string[] = [];

    try {
      for await (const line of openRecordingLines(path)()) {
        lines.push(line);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    expect(lines).toEqual(['first', 'second', 'third']);
  });
});
