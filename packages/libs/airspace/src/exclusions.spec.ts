import type { FeatureCollection, Polygon } from 'geojson';
import { describe, it, beforeAll, expect, assert } from 'vitest';

import { usBundledAirspace } from '@squawk/airspace-data';

import { createAirspaceResolver } from './resolver.js';
import type { AirspaceResolver } from './resolver.js';

/**
 * A square polygon of the given half-width in degrees around a point.
 */
function square(lon: number, lat: number, half: number): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lon - half, lat - half],
        [lon + half, lat - half],
        [lon + half, lat + half],
        [lon - half, lat + half],
        [lon - half, lat - half],
      ],
    ],
  };
}

describe('query with exclusive bounds and exclusions', () => {
  const data: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: square(-100, 40, 1),
        properties: {
          type: 'MOA',
          name: 'TEST MOA',
          identifier: 'MTEST',
          floor: { valueFt: 10000, reference: 'MSL' },
          ceiling: { valueFt: 18000, reference: 'MSL', inclusive: false },
          state: null,
          controllingFacility: null,
          scheduleDescription: null,
          artccStratum: null,
          exclusions: [
            {
              floor: { valueFt: 0, reference: 'SFC' },
              ceiling: { valueFt: 12000, reference: 'MSL' },
              boundary: square(-100, 40, 0.1),
            },
          ],
        },
      },
    ],
  };
  const resolver = createAirspaceResolver({ data });

  it('excludes the value of an exclusive ceiling', () => {
    expect(resolver.query({ lat: 40, lon: -100.5, altitudeFt: 17999 }).length).toBe(1);
    expect(resolver.query({ lat: 40, lon: -100.5, altitudeFt: 18000 }).length).toBe(0);
  });

  it('drops the feature inside an exclusion within its vertical bounds', () => {
    expect(resolver.query({ lat: 40, lon: -100, altitudeFt: 11000 }).length).toBe(0);
    expect(resolver.query({ lat: 40, lon: -100, altitudeFt: 13000 }).length).toBe(1);
    expect(resolver.query({ lat: 40, lon: -100.5, altitudeFt: 11000 }).length).toBe(1);
  });

  it('returns the exclusions with the feature from identifier lookups', () => {
    const [feature] = resolver.byIdentifier('MTEST');
    expect(feature?.exclusions?.length).toBe(1);
    expect(feature?.exclusions?.[0]?.ceiling.valueFt).toBe(12000);
  });
});

describe('A-211 Dothan exclusions in the bundled data', () => {
  let resolver: AirspaceResolver;

  beforeAll(() => {
    resolver = createAirspaceResolver({ data: usBundledAirspace });
  });

  // The alert area excludes the Dothan Regional Class D area below 2,900 ft:
  // a 4.7 nm circle around 31.321 N, 85.449 W.
  it('does not return the alert area inside the carved-out Class D below 2,900 ft', () => {
    const results = resolver.query({ lat: 31.321, lon: -85.449, altitudeFt: 1000 });
    expect(results.some((f) => f.identifier === 'A211')).toBe(false);
  });

  it('returns the alert area above the carve-out', () => {
    const results = resolver.query({ lat: 31.321, lon: -85.449, altitudeFt: 4000 });
    const dothan = results.find((f) => f.identifier === 'A211');
    assert(dothan !== undefined, 'expected A-211 at 4,000 ft');
    expect(dothan.exclusions?.length).toBe(4);
  });
});
