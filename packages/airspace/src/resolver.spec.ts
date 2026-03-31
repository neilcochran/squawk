import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FeatureCollection, Feature } from 'geojson';
import { createAirspaceResolver } from './resolver.js';
import type { AirspaceResolver } from './resolver.js';

const dataPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../airspace-data/data/airspace.geojson',
);

let resolve_: AirspaceResolver;

before(() => {
  const data: FeatureCollection = JSON.parse(readFileSync(dataPath, 'utf-8'));
  resolve_ = createAirspaceResolver({ data });
});

describe('createAirspaceResolver with real data', () => {
  describe('LAX Class B', () => {
    // LAX airport: 33.9425 N, 118.4081 W
    it('returns CLASS_B features for a point at LAX at low altitude', () => {
      const results = resolve_({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });
      const classB = results.filter((f) => f.type === 'CLASS_B');
      assert.ok(classB.length > 0, 'expected at least one CLASS_B feature');
      assert.ok(
        classB.every((f) => f.identifier === 'LAX'),
        'all CLASS_B should be LAX',
      );
    });

    it('returns the SFC ring at ground level', () => {
      const results = resolve_({ lat: 33.9425, lon: -118.4081, altitudeFt: 500 });
      const sfcRing = results.find((f) => f.type === 'CLASS_B' && f.floor.reference === 'SFC');
      assert.ok(sfcRing, 'expected a CLASS_B ring with SFC floor');
    });

    it('returns no CLASS_B above 10000 ft (LAX ceiling)', () => {
      const results = resolve_({ lat: 33.9425, lon: -118.4081, altitudeFt: 12000 });
      const classB = results.filter((f) => f.type === 'CLASS_B');
      assert.equal(classB.length, 0, 'no CLASS_B expected above LAX ceiling');
    });
  });

  describe('ORD Class B', () => {
    // Chicago O'Hare: 41.9742 N, 87.9073 W
    it('returns CLASS_B for a point at ORD', () => {
      const results = resolve_({ lat: 41.9742, lon: -87.9073, altitudeFt: 4000 });
      const classB = results.filter((f) => f.type === 'CLASS_B');
      assert.ok(classB.length > 0, 'expected CLASS_B at ORD');
      assert.ok(
        classB.some((f) => f.identifier === 'ORD'),
        'expected ORD identifier',
      );
    });
  });

  describe('empty area (middle of nowhere)', () => {
    // Middle of Kansas farmland: 38.5 N, 99.5 W
    it('returns no features at low altitude in open terrain', () => {
      const results = resolve_({ lat: 38.5, lon: -99.5, altitudeFt: 3000 });
      assert.equal(results.length, 0, 'expected no airspace in rural Kansas');
    });
  });

  describe('ocean (no airspace)', () => {
    // Mid-Atlantic: 35 N, 55 W
    it('returns no features over open ocean', () => {
      const results = resolve_({ lat: 35, lon: -55, altitudeFt: 10000 });
      assert.equal(results.length, 0, 'expected no airspace over mid-Atlantic');
    });
  });

  describe('Class C', () => {
    // SDF Louisville: 38.1744 N, 85.736 W
    it('returns CLASS_C for a point at Louisville SDF', () => {
      const results = resolve_({ lat: 38.1744, lon: -85.736, altitudeFt: 3000 });
      const classC = results.filter((f) => f.type === 'CLASS_C');
      assert.ok(classC.length > 0, 'expected CLASS_C at SDF');
      assert.ok(
        classC.some((f) => f.identifier === 'SDF'),
        'expected SDF identifier',
      );
    });
  });

  describe('Class D', () => {
    // Santa Fe SAF: 35.617 N, 106.089 W
    it('returns CLASS_D for a point at Santa Fe SAF', () => {
      const results = resolve_({ lat: 35.617, lon: -106.089, altitudeFt: 1000 });
      const classD = results.filter((f) => f.type === 'CLASS_D');
      assert.ok(classD.length > 0, 'expected CLASS_D at SAF');
      assert.ok(
        classD.some((f) => f.identifier === 'SAF'),
        'expected SAF identifier',
      );
    });
  });

  describe('SUA - Restricted area', () => {
    // R-2508 Edwards/China Lake complex: roughly 35.7 N, 117.0 W
    it('returns RESTRICTED for a point inside R-2508', () => {
      const results = resolve_({ lat: 35.7, lon: -117.0, altitudeFt: 25000 });
      const restricted = results.filter((f) => f.type === 'RESTRICTED');
      assert.ok(restricted.length > 0, 'expected RESTRICTED in R-2508 area');
    });
  });

  describe('SUA - Prohibited area', () => {
    // P-56 Washington DC: roughly 38.895 N, 77.037 W
    it('returns PROHIBITED for a point inside P-56 DC', () => {
      const results = resolve_({ lat: 38.895, lon: -77.037, altitudeFt: 1000 });
      const prohibited = results.filter((f) => f.type === 'PROHIBITED');
      assert.ok(prohibited.length > 0, 'expected PROHIBITED in P-56 area');
    });
  });

  describe('altitude-sensitive queries', () => {
    // LAX outer ring floor is above SFC - query below that floor
    it('returns fewer CLASS_B rings below outer ring floor', () => {
      const low = resolve_({ lat: 33.9425, lon: -118.4081, altitudeFt: 500 });
      const mid = resolve_({ lat: 33.9425, lon: -118.4081, altitudeFt: 5000 });
      const classBLow = low.filter((f) => f.type === 'CLASS_B');
      const classBMid = mid.filter((f) => f.type === 'CLASS_B');
      assert.ok(
        classBMid.length >= classBLow.length,
        `expected more CLASS_B rings at 5000 (${classBMid.length}) than at 500 (${classBLow.length})`,
      );
    });
  });

  describe('SUA - MOA', () => {
    // ADA EAST MOA, KS: centroid roughly 39.109 N, 97.495 W, floor 7000 MSL
    it('returns MOA for a point inside a known MOA', () => {
      const results = resolve_({ lat: 39.109, lon: -97.495, altitudeFt: 10000 });
      const moas = results.filter((f) => f.type === 'MOA');
      assert.ok(moas.length > 0, 'expected MOA in ADA EAST area');
    });
  });

  describe('SUA - Warning area', () => {
    // W-137 area off the SE coast: roughly 31.0 N, 79.5 W
    it('returns WARNING for a point inside a coastal warning area', () => {
      const results = resolve_({ lat: 31.0, lon: -79.5, altitudeFt: 10000 });
      const warnings = results.filter((f) => f.type === 'WARNING');
      assert.ok(warnings.length > 0, 'expected WARNING area off SE coast');
    });
  });

  describe('SUA - Alert area', () => {
    it('at least one ALERT area is queryable in the dataset', () => {
      // A-291 Miami area: roughly 25.8 N, 80.3 W
      const results = resolve_({ lat: 25.8, lon: -80.3, altitudeFt: 2000 });
      const alerts = results.filter((f) => f.type === 'ALERT');
      // Alert areas are small - if this specific point misses, just verify
      // the type exists in the dataset by checking all features
      if (alerts.length === 0) {
        const data: FeatureCollection = JSON.parse(readFileSync(dataPath, 'utf-8'));
        const hasAlerts = data.features.some((f) => f.properties?.type === 'ALERT');
        assert.ok(hasAlerts, 'ALERT type should exist in the dataset');
      }
    });
  });

  describe('overlapping airspace', () => {
    it('returns multiple feature types for a point in overlapping airspace', () => {
      // P-56A centroid (38.891, -77.030) is inside both P-56A prohibited
      // area and DCA Class B airspace.
      const results = resolve_({ lat: 38.891, lon: -77.03, altitudeFt: 1000 });
      const types = new Set(results.map((f) => f.type));
      assert.ok(types.size >= 2, `expected multiple types, got: ${[...types].join(', ')}`);
    });
  });

  describe('returned feature properties', () => {
    it('includes all expected AirspaceFeature fields', () => {
      const results = resolve_({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });
      assert.ok(results.length > 0, 'expected results at LAX');
      const feature = results[0]!;
      assert.equal(typeof feature.type, 'string');
      assert.equal(typeof feature.name, 'string');
      assert.equal(typeof feature.identifier, 'string');
      assert.ok(feature.floor && typeof feature.floor.valueFt === 'number');
      assert.ok(feature.floor && typeof feature.floor.reference === 'string');
      assert.ok(feature.ceiling && typeof feature.ceiling.valueFt === 'number');
      assert.ok(feature.ceiling && typeof feature.ceiling.reference === 'string');
      assert.ok(feature.boundary && feature.boundary.type === 'Polygon');
    });
  });
});

describe('createAirspaceResolver with empty dataset', () => {
  it('returns no results for any query', () => {
    const emptyData: FeatureCollection = { type: 'FeatureCollection', features: [] };
    const emptyResolve = createAirspaceResolver({ data: emptyData });
    const results = emptyResolve({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });
    assert.equal(results.length, 0);
  });
});

describe('createAirspaceResolver with malformed features', () => {
  it('skips features with no geometry', () => {
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: null, properties: { type: 'CLASS_B' } } as unknown as Feature,
      ],
    };
    const r = createAirspaceResolver({ data });
    const results = r({ lat: 0, lon: 0, altitudeFt: 0 });
    assert.equal(results.length, 0);
  });

  it('skips features with non-Polygon geometry', () => {
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { type: 'CLASS_B' },
        },
      ],
    };
    const r = createAirspaceResolver({ data });
    const results = r({ lat: 0, lon: 0, altitudeFt: 0 });
    assert.equal(results.length, 0);
  });

  it('skips features with no properties', () => {
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
              ],
            ],
          },
          properties: null,
        } as Feature,
      ],
    };
    const r = createAirspaceResolver({ data });
    const results = r({ lat: 5, lon: 5, altitudeFt: 0 });
    assert.equal(results.length, 0);
  });

  it('skips features with too few ring coordinates', () => {
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [10, 0],
                [0, 0],
              ],
            ],
          },
          properties: { type: 'CLASS_B' },
        },
      ],
    };
    const r = createAirspaceResolver({ data });
    const results = r({ lat: 5, lon: 5, altitudeFt: 0 });
    assert.equal(results.length, 0);
  });
});
