import { describe, expect, it } from 'vitest';

import type { Runway } from '@squawk/types';

import type { PolarTuple } from '../../shared/protocol.js';

import { buildVideoMap, thinLine } from './build.js';
import type { VideoMapSourceData } from './build.js';
import { VIDEO_MAP_LAYER_MAX_RANGE_NM as LIMITS, VIDEO_MAP_VIEW_FACTOR } from './layers.js';
import { makeAirport, makeFix, makeNavaid } from './test-utils.js';

const RECEIVER = { lat: 40, lon: -74 };
const EMPTY: VideoMapSourceData = { airports: [], navaids: [], fixes: [], airspace: [] };

/** One degree of latitude is 60 nm, so this is a position `nm` nautical miles due north of the receiver. */
function northOfReceiver(nm: number): { lat: number; lon: number } {
  return { lat: RECEIVER.lat + nm / 60, lon: RECEIVER.lon };
}

function makeRunway(overrides: Partial<Runway> = {}): Runway {
  return {
    id: '11/29',
    ends: [
      { id: '11', lat: 40.1, lon: -74.01 },
      { id: '29', lat: 40.1, lon: -73.99 },
    ],
    ...overrides,
  };
}

describe('thinLine', () => {
  const dense: PolarTuple[] = [
    [0, 10],
    [0, 10.01],
    [0, 10.02],
    [0, 11],
    [0, 11.01],
    [0, 12],
  ];

  it('merges vertices closer together than the tolerance', () => {
    expect(thinLine(dense, 0.5)).toEqual([
      [0, 10],
      [0, 11],
      [0, 12],
    ]);
  });

  it('always keeps the first and last vertices, so a closed boundary stays closed', () => {
    const ring: PolarTuple[] = [
      [0, 10],
      [0, 10.001],
      [0, 10.002],
      [0, 10],
    ];

    expect(thinLine(ring, 5)).toEqual([
      [0, 10],
      [0, 10],
    ]);
  });

  it('measures distance across bearings, not just along them', () => {
    const arc: PolarTuple[] = [
      [0, 60],
      [0.1, 60],
      [10, 60],
      [20, 60],
    ];

    expect(thinLine(arc, 1)).toEqual([
      [0, 60],
      [10, 60],
      [20, 60],
    ]);
  });

  it('keeps every vertex with a zero tolerance, and returns short lines unchanged', () => {
    expect(thinLine(dense, 0)).toEqual(dense);
    expect(thinLine([], 1)).toEqual([]);
    expect(thinLine([[0, 1]], 1)).toEqual([[0, 1]]);
    expect(
      thinLine(
        [
          [0, 1],
          [0, 1.0001],
        ],
        1,
      ),
    ).toEqual([
      [0, 1],
      [0, 1.0001],
    ]);
  });

  it('does not mutate its input', () => {
    const copy = dense.map((point) => [...point]);

    thinLine(dense, 0.5);

    expect(dense).toEqual(copy);
  });
});

describe('buildVideoMap', () => {
  it('builds an empty map from no data, stamped with the range', () => {
    expect(buildVideoMap(EMPTY, RECEIVER, 60)).toEqual({ rangeNm: 60, points: [], lines: [] });
  });

  it('labels an airport by ICAO code, falling back to its FAA id, and resolves its position', () => {
    const data: VideoMapSourceData = {
      ...EMPTY,
      airports: [
        makeAirport({ icao: 'KTST', ...northOfReceiver(6) }),
        makeAirport({ faaId: '2B2', ...northOfReceiver(3) }),
      ],
    };

    const map = buildVideoMap(data, RECEIVER, 10);

    expect(map.points.map((point) => point.label)).toEqual(['KTST', '2B2']);
    expect(map.points[0]).toMatchObject({ kind: 'airport' });
    expect(map.points[0]?.position.trueBearingDeg).toBe(0);
    expect(map.points[0]?.position.rangeNm).toBeCloseTo(6, 1);
  });

  it('includes only what lies within view, which reaches past the range to the screen corners', () => {
    const inView = 20 * VIDEO_MAP_VIEW_FACTOR - 1;
    const outOfView = 20 * VIDEO_MAP_VIEW_FACTOR + 1;
    const data: VideoMapSourceData = {
      ...EMPTY,
      airports: [
        makeAirport({ icao: 'KNEAR', ...northOfReceiver(inView) }),
        makeAirport({ icao: 'KFAR', ...northOfReceiver(outOfView) }),
      ],
      navaids: [makeNavaid({ identifier: 'FAR', ...northOfReceiver(outOfView) })],
      fixes: [makeFix({ identifier: 'FARRR', ...northOfReceiver(outOfView) })],
    };

    expect(buildVideoMap(data, RECEIVER, 20).points.map((point) => point.label)).toEqual(['KNEAR']);
  });

  it('applies the layer limits, so the map thins as the range grows', () => {
    const data: VideoMapSourceData = {
      ...EMPTY,
      airports: [
        makeAirport({ faaId: 'SMALL', ...northOfReceiver(1) }),
        makeAirport({ icao: 'KTWR', towerType: 'ATCT', ...northOfReceiver(2) }),
      ],
      navaids: [makeNavaid({ identifier: 'VOR', ...northOfReceiver(3) })],
      fixes: [makeFix({ identifier: 'FIXXX', ...northOfReceiver(4) })],
    };

    const closeIn = buildVideoMap(data, RECEIVER, LIMITS.publicAirports);
    const zoomedOut = buildVideoMap(data, RECEIVER, LIMITS.vorNavaids + 1);

    expect(closeIn.points.map((point) => `${point.kind}:${point.label}`)).toEqual([
      'airport:SMALL',
      'airport:KTWR',
      'navaid:VOR',
      'fix:FIXXX',
    ]);
    expect(zoomedOut.points.map((point) => point.label)).toEqual(['KTWR']);
  });

  it('sends a fix without its label beyond the fix label limit', () => {
    const data: VideoMapSourceData = {
      ...EMPTY,
      fixes: [makeFix({ identifier: 'FIXXX', ...northOfReceiver(4) })],
    };

    const labeled = buildVideoMap(data, RECEIVER, LIMITS.fixLabels).points[0];
    const bare = buildVideoMap(data, RECEIVER, LIMITS.fixLabels + 1).points[0];

    expect(labeled?.label).toBe('FIXXX');
    expect(bare?.kind).toBe('fix');
    expect(bare).not.toHaveProperty('label');
  });

  describe('runways', () => {
    it('draws each runway end to end and marks the airport as outlined', () => {
      const airport = makeAirport({
        towerType: 'ATCT',
        runways: [makeRunway(), makeRunway({ id: '18/36' })],
      });

      const map = buildVideoMap({ ...EMPTY, airports: [airport] }, RECEIVER, LIMITS.runways);

      expect(map.points[0]?.outlined).toBe(true);
      expect(map.lines).toHaveLength(2);
      expect(map.lines[0]?.kind).toBe('runway');
      expect(map.lines[0]?.points).toHaveLength(2);
      const [west, east] = map.lines[0]?.points ?? [];
      expect(west?.[0]).toBeGreaterThan(270);
      expect(east?.[0]).toBeLessThan(90);
    });

    it('sends no runways beyond the runway limit, leaving the airport to its symbol', () => {
      const airport = makeAirport({ towerType: 'ATCT', runways: [makeRunway()] });

      const map = buildVideoMap({ ...EMPTY, airports: [airport] }, RECEIVER, LIMITS.runways + 1);

      expect(map.lines).toEqual([]);
      expect(map.points[0]).not.toHaveProperty('outlined');
    });

    it('skips a runway whose ends are not both located', () => {
      const airport = makeAirport({
        runways: [
          makeRunway({ ends: [{ id: '11', lat: 40.1, lon: -74.01 }, { id: '29' }] }),
          makeRunway({
            ends: [
              { id: '11', lat: 40.1 },
              { id: '29', lat: 40.1, lon: -73.99 },
            ],
          }),
          makeRunway({ ends: [{ id: 'H1', lat: 40.1, lon: -74 }] }),
        ],
      });

      const map = buildVideoMap({ ...EMPTY, airports: [airport] }, RECEIVER, 10);

      expect(map.lines).toEqual([]);
      expect(map.points[0]).not.toHaveProperty('outlined');
    });
  });

  describe('airspace', () => {
    const ring = [
      northOfReceiver(5),
      { lat: RECEIVER.lat + 5 / 60, lon: RECEIVER.lon + 0.1 },
      northOfReceiver(8),
      northOfReceiver(5),
    ];

    it('draws every ring of a boundary as a closed line, ahead of the runways', () => {
      const hole = ring.map((vertex) => ({ lat: vertex.lat + 0.01, lon: vertex.lon }));
      const data: VideoMapSourceData = {
        ...EMPTY,
        airports: [makeAirport({ runways: [makeRunway()] })],
        airspace: [{ type: 'CLASS_C', rings: [ring, hole] }],
      };

      const map = buildVideoMap(data, RECEIVER, 10);

      expect(map.lines.map((line) => line.kind)).toEqual(['airspace', 'airspace', 'runway']);
      expect(map.lines[0]).toHaveProperty('airspaceClass', 'classC');
      expect(map.lines[2]).not.toHaveProperty('airspaceClass');
      expect(map.lines[0]?.points.at(0)).toEqual(map.lines[0]?.points.at(-1));
    });

    it('includes a boundary whole when any of its outer ring is in view, and not otherwise', () => {
      const straddling = [northOfReceiver(10), northOfReceiver(500), northOfReceiver(10)];
      const distant = [northOfReceiver(400), northOfReceiver(500), northOfReceiver(400)];
      const data: VideoMapSourceData = {
        ...EMPTY,
        airspace: [
          { type: 'CLASS_B', rings: [straddling] },
          { type: 'CLASS_B', rings: [distant] },
        ],
      };

      const map = buildVideoMap(data, RECEIVER, 20);

      expect(map.lines).toHaveLength(1);
      expect(map.lines[0]?.points).toHaveLength(3);
    });

    it('applies the airspace layer limits, and skips a boundary with no rings', () => {
      const data: VideoMapSourceData = {
        ...EMPTY,
        airspace: [
          { type: 'CLASS_D', rings: [ring] },
          { type: 'MOA', rings: [ring] },
          { type: 'CLASS_B', rings: [] },
        ],
      };

      const atLimit = buildVideoMap(data, RECEIVER, LIMITS.classD).lines;
      expect(atLimit).toHaveLength(1);
      expect(atLimit[0]).toHaveProperty('airspaceClass', 'classD');
      expect(buildVideoMap(data, RECEIVER, LIMITS.classD + 1).lines).toHaveLength(0);
    });

    it('thins dense boundaries more the further the scope is zoomed out', () => {
      const dense = Array.from({ length: 200 }, (_, index) => northOfReceiver(5 + index * 0.01));
      const data: VideoMapSourceData = {
        ...EMPTY,
        airspace: [{ type: 'CLASS_B', rings: [dense] }],
      };

      const closeIn = buildVideoMap(data, RECEIVER, 5).lines[0]?.points.length ?? 0;
      const zoomedOut = buildVideoMap(data, RECEIVER, 250).lines[0]?.points.length ?? 0;

      expect(closeIn).toBeGreaterThan(zoomedOut);
      expect(zoomedOut).toBeGreaterThanOrEqual(2);
    });
  });
});
