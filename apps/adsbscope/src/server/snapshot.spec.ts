import { describe, expect, it, vi } from 'vitest';

import type { AircraftFeed, PositionHistoryEntry } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import {
  buildSnapshot,
  HISTORY_POINT_COUNT,
  HISTORY_SPACING_MS,
  sampleHistory,
  toPolarPoint,
  toScopeTarget,
} from './snapshot.js';

const RECEIVER = { lat: 40, lon: -74 };
const NOW = 1_000_000;

function entryAt(recordedAt: number, lat = 40.5): PositionHistoryEntry {
  return { position: { lat, lon: -74 }, recordedAt };
}

describe('toPolarPoint', () => {
  it('resolves a point due north of the receiver', () => {
    const point = toPolarPoint(RECEIVER, { lat: 41, lon: -74 });

    expect(point.trueBearingDeg).toBe(0);
    expect(point.rangeNm).toBeGreaterThan(59.9);
    expect(point.rangeNm).toBeLessThan(60.2);
  });

  it('resolves a point due east of the receiver', () => {
    const point = toPolarPoint({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });

    expect(point.trueBearingDeg).toBe(90);
  });

  it('rounds bearing to hundredths of a degree and range to thousandths of a nautical mile', () => {
    const point = toPolarPoint(RECEIVER, { lat: 40.123456, lon: -73.654321 });

    expect(point.trueBearingDeg).toBe(Math.round(point.trueBearingDeg * 100) / 100);
    expect(point.rangeNm).toBe(Math.round(point.rangeNm * 1000) / 1000);
  });
});

describe('sampleHistory', () => {
  it('returns nothing for an empty history', () => {
    expect(sampleHistory([], NOW)).toEqual([]);
  });

  it('skips entries newer than one spacing interval', () => {
    expect(sampleHistory([entryAt(NOW - 1000), entryAt(NOW - 100)], NOW)).toEqual([]);
  });

  it('keeps one entry per spacing interval, oldest first', () => {
    const entries = Array.from({ length: 31 }, (_, second) => entryAt(NOW - (30 - second) * 1000));

    const sampled = sampleHistory(entries, NOW);

    expect(sampled.map((entry) => NOW - entry.recordedAt)).toEqual([
      25_000, 20_000, 15_000, 10_000, 5000,
    ]);
  });

  it('caps the trail at the point count', () => {
    const entries = Array.from({ length: 120 }, (_, second) =>
      entryAt(NOW - (119 - second) * 1000),
    );

    const sampled = sampleHistory(entries, NOW);

    expect(sampled).toHaveLength(HISTORY_POINT_COUNT);
    expect(sampled.at(-1)?.recordedAt).toBe(NOW - HISTORY_SPACING_MS);
  });

  it('spaces from each kept entry when the history has gaps', () => {
    const entries = [entryAt(NOW - 40_000), entryAt(NOW - 22_000), entryAt(NOW - 19_000)];

    const sampled = sampleHistory(entries, NOW);

    expect(sampled.map((entry) => NOW - entry.recordedAt)).toEqual([40_000, 19_000]);
  });
});

describe('toScopeTarget', () => {
  it('carries only the identity and timestamp for a bare aircraft', () => {
    expect(toScopeTarget({ icaoHex: 'a1b2c3', lastSeenAt: NOW }, [], RECEIVER, NOW)).toEqual({
      icaoHex: 'a1b2c3',
      history: [],
      lastSeenAt: NOW,
    });
  });

  it('maps every populated field and resolves the position and history', () => {
    const aircraft: Aircraft = {
      icaoHex: 'a1b2c3',
      callsign: 'UAL123',
      squawk: '1200',
      position: { lat: 41, lon: -74, baroAltitudeFt: 12_000, geoAltitudeFt: 12_300 },
      groundSpeedKt: 250,
      trueTrackDeg: 180,
      verticalRateFtPerMin: -800,
      onGround: false,
      lastSeenAt: NOW,
    };

    const target = toScopeTarget(aircraft, [entryAt(NOW - 6000, 41.01)], RECEIVER, NOW);

    expect(target).toMatchObject({
      icaoHex: 'a1b2c3',
      callsign: 'UAL123',
      squawk: '1200',
      altitudeFt: 12_000,
      groundSpeedKt: 250,
      trueTrackDeg: 180,
      verticalRateFtPerMin: -800,
      onGround: false,
      lastSeenAt: NOW,
    });
    expect(target.position?.trueBearingDeg).toBe(0);
    expect(target.history).toHaveLength(1);
    expect(target.history[0]?.rangeNm).toBeGreaterThan(target.position?.rangeNm ?? Infinity);
  });

  it('rounds derived values to what a data block can show', () => {
    const target = toScopeTarget(
      {
        icaoHex: 'a1b2c3',
        position: { lat: 41, lon: -74, baroAltitudeFt: 35_999.6 },
        groundSpeedKt: 533.1050553127404,
        trueTrackDeg: 132.8149,
        verticalRateFtPerMin: -63.7,
        lastSeenAt: NOW,
      },
      [],
      RECEIVER,
      NOW,
    );

    expect(target.altitudeFt).toBe(36_000);
    expect(target.groundSpeedKt).toBe(533);
    expect(target.trueTrackDeg).toBe(132.8);
    expect(target.verticalRateFtPerMin).toBe(-64);
  });

  it('falls back to geometric altitude when there is no barometric altitude', () => {
    const target = toScopeTarget(
      { icaoHex: 'a1b2c3', position: { lat: 41, lon: -74, geoAltitudeFt: 5500 }, lastSeenAt: NOW },
      [],
      RECEIVER,
      NOW,
    );

    expect(target.altitudeFt).toBe(5500);
  });
});

describe('buildSnapshot', () => {
  it('snapshots every tracked aircraft, ordered by ICAO hex, with the connection state', () => {
    const aircraft: Aircraft[] = [
      { icaoHex: 'c0ffee', lastSeenAt: NOW },
      { icaoHex: 'a1b2c3', position: { lat: 41, lon: -74 }, lastSeenAt: NOW },
    ];
    const getPositionHistory = vi.fn((): PositionHistoryEntry[] => []);
    const feed: AircraftFeed = Object.assign(new EventTarget(), {
      start: vi.fn(),
      stop: vi.fn(),
      getAircraft: vi.fn(() => undefined),
      getAllAircraft: vi.fn(() => aircraft),
      getPositionHistory,
      getConnectionState: vi.fn(() => 'connected' as const),
    });

    const snapshot = buildSnapshot(feed, RECEIVER, NOW);

    expect(snapshot.at).toBe(NOW);
    expect(snapshot.connection).toBe('connected');
    expect(snapshot.targets.map((target) => target.icaoHex)).toEqual(['a1b2c3', 'c0ffee']);
    expect(getPositionHistory).toHaveBeenCalledWith('a1b2c3');
    expect(getPositionHistory).toHaveBeenCalledWith('c0ffee');
  });
});
