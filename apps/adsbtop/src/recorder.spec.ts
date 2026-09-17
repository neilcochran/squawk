import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AircraftLostEventDetail, AircraftUpdateEventDetail } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import { createEventRecorder, formatRecordLine, openRecordSink } from './recorder.js';
import type { RecordSink } from './recorder.js';
import { createFakeAircraftFeed } from './test-utils.js';
import type { FakeAircraftFeed } from './test-utils.js';

function makeAircraft(icaoHex: string, overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex, lastSeenAt: 0, ...overrides };
}

function dispatchUpdate(
  feed: FakeAircraftFeed,
  type: 'aircraft:new' | 'aircraft:update',
  aircraft: Aircraft,
): void {
  const detail: AircraftUpdateEventDetail = { aircraft };
  feed.dispatchEvent(new CustomEvent(type, { detail }));
}

function dispatchLost(feed: FakeAircraftFeed, lastAircraft: Aircraft): void {
  const detail: AircraftLostEventDetail = { icaoHex: lastAircraft.icaoHex, lastAircraft };
  feed.dispatchEvent(new CustomEvent('aircraft:lost', { detail }));
}

function memorySink(): RecordSink & { lines: string[]; ended: boolean } {
  const sink = {
    lines: [] as string[],
    ended: false,
    write(line: string): void {
      sink.lines.push(line);
    },
    end(): void {
      sink.ended = true;
    },
  };
  return sink;
}

describe('formatRecordLine', () => {
  it('serializes an event as one newline-terminated JSON object with type and time first', () => {
    const line = formatRecordLine({
      type: 'new',
      at: 1000,
      aircraft: makeAircraft('A0B1C2', { callsign: 'UAL123' }),
    });

    expect(line).toBe(
      '{"type":"new","at":1000,"aircraft":{"icaoHex":"A0B1C2","lastSeenAt":0,"callsign":"UAL123"}}\n',
    );
  });
});

describe('createEventRecorder', () => {
  it('writes new, update, and lost events in order and closes the sink on stop', () => {
    const feed = createFakeAircraftFeed();
    const sink = memorySink();
    let clock = 1000;
    const recorder = createEventRecorder(feed, sink, () => clock);

    dispatchUpdate(feed, 'aircraft:new', makeAircraft('A0B1C2'));
    clock = 2000;
    dispatchUpdate(feed, 'aircraft:update', makeAircraft('A0B1C2', { groundSpeedKt: 250 }));
    clock = 3000;
    dispatchLost(feed, makeAircraft('A0B1C2', { groundSpeedKt: 250 }));

    expect(sink.lines.map((line) => JSON.parse(line))).toEqual([
      { type: 'new', at: 1000, aircraft: { icaoHex: 'A0B1C2', lastSeenAt: 0 } },
      {
        type: 'update',
        at: 2000,
        aircraft: { icaoHex: 'A0B1C2', lastSeenAt: 0, groundSpeedKt: 250 },
      },
      {
        type: 'lost',
        at: 3000,
        icaoHex: 'A0B1C2',
        lastAircraft: { icaoHex: 'A0B1C2', lastSeenAt: 0, groundSpeedKt: 250 },
      },
    ]);

    recorder.stop();
    expect(sink.ended).toBe(true);
    dispatchUpdate(feed, 'aircraft:new', makeAircraft('D3E4F5'));
    expect(sink.lines).toHaveLength(3);
  });
});

describe('openRecordSink', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('appends lines to the file across two sinks', async () => {
    dir = mkdtempSync(join(tmpdir(), 'adsbtop-record-'));
    const path = join(dir, 'events.jsonl');
    const onError = vi.fn();

    const first = openRecordSink(path, onError);
    first.write('one\n');
    first.end();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const second = openRecordSink(path, onError);
    second.write('two\n');
    second.end();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(readFileSync(path, 'utf8')).toBe('one\ntwo\n');
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a stream error through onError instead of throwing', async () => {
    dir = mkdtempSync(join(tmpdir(), 'adsbtop-record-'));
    const onError = vi.fn();

    const sink = openRecordSink(join(dir, 'missing', 'events.jsonl'), onError);
    sink.write('one\n');
    sink.end();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
