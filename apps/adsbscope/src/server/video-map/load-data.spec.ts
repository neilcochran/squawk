import { beforeAll, describe, expect, it } from 'vitest';

import { buildVideoMap } from './build.js';
import type { VideoMapSourceData } from './build.js';
import { adaptAirspaceFeatures, loadBundledVideoMapData } from './load-data.js';

describe('adaptAirspaceFeatures', () => {
  it('reduces a polygon feature to its type and rings, swapping GeoJSON lon/lat to lat/lon', () => {
    const features = [
      {
        properties: { type: 'CLASS_C', name: 'TEST CLASS C' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-74, 40],
              [-73.9, 40],
              [-74, 40],
            ],
            [[-73.95, 40.01]],
          ],
        },
      },
    ];

    expect(adaptAirspaceFeatures(features)).toEqual([
      {
        type: 'CLASS_C',
        rings: [
          [
            { lat: 40, lon: -74 },
            { lat: 40, lon: -73.9 },
            { lat: 40, lon: -74 },
          ],
          [{ lat: 40.01, lon: -73.95 }],
        ],
      },
    ]);
  });

  it('skips features that are not polygons, have no string type, or have no coordinates', () => {
    const polygon = { type: 'Polygon', coordinates: [[[-74, 40]]] };

    expect(
      adaptAirspaceFeatures([
        { properties: { type: 'CLASS_B' }, geometry: { type: 'MultiPolygon', coordinates: [] } },
        { properties: null, geometry: polygon },
        { properties: { type: 7 }, geometry: polygon },
        { properties: { type: 'CLASS_B' }, geometry: { type: 'Polygon' } },
      ]),
    ).toEqual([]);
  });

  it('drops malformed rings and vertices rather than failing', () => {
    const features = [
      {
        properties: { type: 'CLASS_D' },
        geometry: {
          type: 'Polygon',
          coordinates: ['not a ring', [[-74, 40], ['x', 40], [-74], 5]],
        },
      },
    ];

    expect(adaptAirspaceFeatures(features)).toEqual([
      { type: 'CLASS_D', rings: [[], [{ lat: 40, lon: -74 }]] },
    ]);
  });
});

describe('loadBundledVideoMapData', () => {
  let data: VideoMapSourceData;

  beforeAll(async () => {
    data = await loadBundledVideoMapData();
  });

  it('loads every dataset from the bundled FAA snapshots', () => {
    expect(data.airports.length).toBeGreaterThan(10_000);
    expect(data.navaids.length).toBeGreaterThan(1000);
    expect(data.fixes.length).toBeGreaterThan(50_000);
    expect(data.airspace.length).toBeGreaterThan(5000);
  });

  it('adapts every airspace feature into at least one ring of real positions', () => {
    for (const airspace of data.airspace) {
      expect(airspace.rings.length).toBeGreaterThan(0);
      expect(airspace.rings[0]?.length).toBeGreaterThan(2);
    }
    const vertex = data.airspace[0]?.rings[0]?.[0];
    expect(Math.abs(vertex?.lat ?? 999)).toBeLessThanOrEqual(90);
    expect(Math.abs(vertex?.lon ?? 999)).toBeLessThanOrEqual(180);
  });

  it('builds a recognizable map around a real airport', () => {
    const portland = { lat: 43.6462, lon: -70.3093 };

    const map = buildVideoMap(data, portland, 20);

    const pwm = map.points.find((point) => point.label === 'KPWM');
    expect(pwm).toMatchObject({ kind: 'airport', outlined: true });
    expect(pwm?.position.rangeNm).toBeLessThan(1);
    expect(map.lines.some((line) => line.kind === 'runway')).toBe(true);
    expect(map.lines.some((line) => line.kind === 'airspace')).toBe(true);
    expect(map.points.some((point) => point.kind === 'navaid')).toBe(true);
    expect(map.points.some((point) => point.kind === 'fix')).toBe(true);
  });

  it('keeps a wide map to a drawable size', () => {
    const map = buildVideoMap(data, { lat: 40.6413, lon: -73.7781 }, 250);

    const vertexCount = map.lines.reduce((sum, line) => sum + line.points.length, 0);
    expect(map.points.length).toBeLessThan(500);
    expect(vertexCount).toBeLessThan(20_000);
  });
});
