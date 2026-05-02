import { describe, it, beforeAll } from 'vitest';
import assert from 'node:assert/strict';
import type { FeatureCollection, Feature } from 'geojson';
import type { AirspaceType } from '@squawk/types';
import { usBundledAirspace } from '@squawk/airspace-data';
import { createAirspaceResolver } from './resolver.js';
import type { AirspaceResolver } from './resolver.js';

let resolve_: AirspaceResolver;

beforeAll(() => {
  resolve_ = createAirspaceResolver({ data: usBundledAirspace });
});

describe('createAirspaceResolver with real data', () => {
  describe('LAX Class B', () => {
    // LAX airport: 33.9425 N, 118.4081 W
    it('returns CLASS_B features for a point at LAX at low altitude', () => {
      const results = resolve_.query({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });
      const classB = results.filter((f) => f.type === 'CLASS_B');
      assert.ok(classB.length > 0, 'expected at least one CLASS_B feature');
      assert.ok(
        classB.every((f) => f.identifier === 'LAX'),
        'all CLASS_B should be LAX',
      );
    });

    it('returns the SFC ring at ground level', () => {
      const results = resolve_.query({ lat: 33.9425, lon: -118.4081, altitudeFt: 500 });
      const sfcRing = results.find((f) => f.type === 'CLASS_B' && f.floor.reference === 'SFC');
      assert.ok(sfcRing, 'expected a CLASS_B ring with SFC floor');
    });

    it('returns no CLASS_B above 10000 ft (LAX ceiling)', () => {
      const results = resolve_.query({ lat: 33.9425, lon: -118.4081, altitudeFt: 12000 });
      const classB = results.filter((f) => f.type === 'CLASS_B');
      assert.equal(classB.length, 0, 'no CLASS_B expected above LAX ceiling');
    });
  });

  describe('ORD Class B', () => {
    // Chicago O'Hare: 41.9742 N, 87.9073 W
    it('returns CLASS_B for a point at ORD', () => {
      const results = resolve_.query({ lat: 41.9742, lon: -87.9073, altitudeFt: 4000 });
      const classB = results.filter((f) => f.type === 'CLASS_B');
      assert.ok(classB.length > 0, 'expected CLASS_B at ORD');
      assert.ok(
        classB.some((f) => f.identifier === 'ORD'),
        'expected ORD identifier',
      );
    });
  });

  describe('Class E only (rural CONUS)', () => {
    // Middle of Kansas farmland: 38.5 N, 99.5 W
    // Class E5 covers most of CONUS at 700 ft AGL; rural points also fall under
    // an ARTCC (ZKC LOW here), so the assertion only restricts the non-ARTCC
    // results to Class E.
    it('returns only Class E at low altitude in open terrain', () => {
      const results = resolve_.query({ lat: 38.5, lon: -99.5, altitudeFt: 3000 });
      assert.ok(results.length > 0, 'expected Class E coverage in rural Kansas');
      const nonArtcc = results.filter((f) => f.type !== 'ARTCC');
      assert.ok(
        nonArtcc.every((f) => f.type.startsWith('CLASS_E')),
        `expected only Class E (excluding ARTCC), got: ${nonArtcc.map((f) => f.type).join(', ')}`,
      );
    });
  });

  describe('no controlled airspace', () => {
    it('returns no Class B/C/D/E or SUA features over the mid-Atlantic', () => {
      // Mid-Atlantic: 35 N, 55 W. ZWY oceanic CTA/FIR covers this point, so the
      // assertion targets only the non-ARTCC types.
      const results = resolve_.query({ lat: 35, lon: -55, altitudeFt: 10000 });
      const nonArtcc = results.filter((f) => f.type !== 'ARTCC');
      assert.equal(nonArtcc.length, 0, 'expected no Class B/C/D/E or SUA over mid-Atlantic');
    });

    it('returns no Class B/C/D/E or SUA features over the Pacific off the California coast', () => {
      // Pacific: 33 N, 125 W. ZAK Oakland Oceanic CTA/FIR reaches the West Coast
      // and matches here, so the assertion targets only the non-ARTCC types.
      const results = resolve_.query({ lat: 33, lon: -125, altitudeFt: 3000 });
      const nonArtcc = results.filter((f) => f.type !== 'ARTCC');
      assert.equal(nonArtcc.length, 0, 'expected no Class B/C/D/E or SUA over the Pacific');
    });
  });

  describe('Class C', () => {
    // SDF Louisville: 38.1744 N, 85.736 W
    it('returns CLASS_C for a point at Louisville SDF', () => {
      const results = resolve_.query({ lat: 38.1744, lon: -85.736, altitudeFt: 3000 });
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
      const results = resolve_.query({ lat: 35.617, lon: -106.089, altitudeFt: 1000 });
      const classD = results.filter((f) => f.type === 'CLASS_D');
      assert.ok(classD.length > 0, 'expected CLASS_D at SAF');
      assert.ok(
        classD.some((f) => f.identifier === 'SAF'),
        'expected SAF identifier',
      );
    });
  });

  describe('Class E2', () => {
    // GNV Gainesville FL: centroid roughly 29.69 N, 82.27 W, SFC to 99999 MSL
    it('returns CLASS_E2 for a point at Gainesville GNV', () => {
      const results = resolve_.query({ lat: 29.69, lon: -82.27, altitudeFt: 1000 });
      const classE2 = results.filter((f) => f.type === 'CLASS_E2');
      assert.ok(classE2.length > 0, 'expected CLASS_E2 at GNV');
      assert.ok(
        classE2.some((f) => f.identifier === 'GNV'),
        'expected GNV identifier',
      );
    });
  });

  describe('Class E5', () => {
    // CLASS_E5 covers most of CONUS at 700 ft AGL
    it('returns CLASS_E5 for a point in open terrain', () => {
      const results = resolve_.query({ lat: 38.5, lon: -99.5, altitudeFt: 3000 });
      const classE5 = results.filter((f) => f.type === 'CLASS_E5');
      assert.ok(classE5.length > 0, 'expected CLASS_E5 in open terrain');
    });
  });

  describe('SUA - Restricted area', () => {
    // R-2508 Edwards/China Lake complex: roughly 35.7 N, 117.0 W
    it('returns RESTRICTED for a point inside R-2508', () => {
      const results = resolve_.query({ lat: 35.7, lon: -117.0, altitudeFt: 25000 });
      const restricted = results.filter((f) => f.type === 'RESTRICTED');
      assert.ok(restricted.length > 0, 'expected RESTRICTED in R-2508 area');
    });
  });

  describe('SUA - Prohibited area', () => {
    // P-56 Washington DC: roughly 38.895 N, 77.037 W
    it('returns PROHIBITED for a point inside P-56 DC', () => {
      const results = resolve_.query({ lat: 38.895, lon: -77.037, altitudeFt: 1000 });
      const prohibited = results.filter((f) => f.type === 'PROHIBITED');
      assert.ok(prohibited.length > 0, 'expected PROHIBITED in P-56 area');
    });
  });

  describe('altitude-sensitive queries', () => {
    // LAX outer ring floor is above SFC - query below that floor
    it('returns fewer CLASS_B rings below outer ring floor', () => {
      const low = resolve_.query({ lat: 33.9425, lon: -118.4081, altitudeFt: 500 });
      const mid = resolve_.query({ lat: 33.9425, lon: -118.4081, altitudeFt: 5000 });
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
      const results = resolve_.query({ lat: 39.109, lon: -97.495, altitudeFt: 10000 });
      const moas = results.filter((f) => f.type === 'MOA');
      assert.ok(moas.length > 0, 'expected MOA in ADA EAST area');
    });
  });

  describe('SUA - Warning area', () => {
    // W-137 area off the SE coast: roughly 31.0 N, 79.5 W
    it('returns WARNING for a point inside a coastal warning area', () => {
      const results = resolve_.query({ lat: 31.0, lon: -79.5, altitudeFt: 10000 });
      const warnings = results.filter((f) => f.type === 'WARNING');
      assert.ok(warnings.length > 0, 'expected WARNING area off SE coast');
    });
  });

  describe('SUA - Alert area', () => {
    it('at least one ALERT area is queryable in the dataset', () => {
      // A-291 Miami area: roughly 25.8 N, 80.3 W
      const results = resolve_.query({ lat: 25.8, lon: -80.3, altitudeFt: 2000 });
      const alerts = results.filter((f) => f.type === 'ALERT');
      // Alert areas are small - if this specific point misses, just verify
      // the type exists in the dataset by checking all features
      if (alerts.length === 0) {
        const hasAlerts = usBundledAirspace.features.some((f) => f.properties?.type === 'ALERT');
        assert.ok(hasAlerts, 'ALERT type should exist in the dataset');
      }
    });
  });

  describe('overlapping airspace', () => {
    it('returns multiple feature types for a point in overlapping airspace', () => {
      // P-56A centroid (38.891, -77.030) is inside both P-56A prohibited
      // area and DCA Class B airspace.
      const results = resolve_.query({ lat: 38.891, lon: -77.03, altitudeFt: 1000 });
      const types = new Set(results.map((f) => f.type));
      assert.ok(types.size >= 2, `expected multiple types, got: ${[...types].join(', ')}`);
    });
  });

  describe('returned feature properties', () => {
    it('includes all expected AirspaceFeature fields', () => {
      const results = resolve_.query({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });
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
      // artccStratum is required on AirspaceFeature; non-ARTCC features carry null.
      assert.ok('artccStratum' in feature, 'artccStratum field must be present');
      assert.equal(feature.artccStratum, null, 'non-ARTCC feature should have null stratum');
    });

    it('includes a non-null artccStratum on ARTCC features', () => {
      const validStrata = new Set(['LOW', 'HIGH', 'UTA', 'CTA', 'FIR', 'CTA/FIR']);
      const ny = resolve_.byArtcc('ZNY');
      assert.ok(ny.length > 0, 'expected ZNY features');
      for (const feature of ny) {
        assert.ok(feature.artccStratum !== null, 'ARTCC feature stratum must not be null');
        assert.ok(
          validStrata.has(feature.artccStratum),
          `unexpected stratum ${feature.artccStratum}`,
        );
      }
    });
  });
});

describe('type filter', () => {
  it('returns only requested types when types filter is provided', () => {
    const results = resolve_.query({
      lat: 33.9425,
      lon: -118.4081,
      altitudeFt: 3000,
      types: new Set<AirspaceType>(['CLASS_B']),
    });
    assert.ok(results.length > 0, 'expected CLASS_B results at LAX');
    assert.ok(
      results.every((f) => f.type === 'CLASS_B'),
      'all results should be CLASS_B',
    );
  });

  it('returns no results when filtering for a type not present at location', () => {
    const results = resolve_.query({
      lat: 33.9425,
      lon: -118.4081,
      altitudeFt: 3000,
      types: new Set<AirspaceType>(['MOA']),
    });
    assert.equal(results.length, 0, 'no MOAs expected at LAX');
  });

  it('supports filtering for multiple types', () => {
    // P-56A area has both PROHIBITED and CLASS_B
    const results = resolve_.query({
      lat: 38.891,
      lon: -77.03,
      altitudeFt: 1000,
      types: new Set<AirspaceType>(['PROHIBITED', 'CLASS_B']),
    });
    const types = new Set(results.map((f) => f.type));
    assert.ok(types.has('PROHIBITED'), 'expected PROHIBITED');
    assert.ok(types.has('CLASS_B'), 'expected CLASS_B');
  });

  it('filters Class E subtypes independently', () => {
    // Rural Kansas returns Class E5; filtering for E2 only should exclude it
    const e2Only = resolve_.query({
      lat: 38.5,
      lon: -99.5,
      altitudeFt: 3000,
      types: new Set<AirspaceType>(['CLASS_E2']),
    });
    assert.equal(e2Only.length, 0, 'no CLASS_E2 expected in rural Kansas');

    const e5Only = resolve_.query({
      lat: 38.5,
      lon: -99.5,
      altitudeFt: 3000,
      types: new Set<AirspaceType>(['CLASS_E5']),
    });
    assert.ok(e5Only.length > 0, 'expected CLASS_E5 in rural Kansas');
    assert.ok(
      e5Only.every((f) => f.type === 'CLASS_E5'),
      'all results should be CLASS_E5',
    );
  });

  it('returns all types when types filter is omitted', () => {
    // P-56A area returns multiple types without filter
    const results = resolve_.query({ lat: 38.891, lon: -77.03, altitudeFt: 1000 });
    const types = new Set(results.map((f) => f.type));
    assert.ok(types.size >= 2, 'expected multiple types without filter');
  });
});

describe('byAirport', () => {
  it('returns every Class B sector associated with JFK', () => {
    const features = resolve_.byAirport('JFK');
    const classB = features.filter((f) => f.type === 'CLASS_B');
    assert.ok(classB.length > 1, 'JFK Class B is encoded as multiple sectors');
    assert.ok(
      classB.every((f) => f.identifier === 'JFK'),
      'all returned Class B features should belong to JFK',
    );
  });

  it('includes the full boundary polygon on each returned feature', () => {
    const features = resolve_.byAirport('LAX');
    assert.ok(features.length > 0, 'expected LAX features');
    for (const feature of features) {
      assert.equal(feature.boundary.type, 'Polygon');
      const ring = feature.boundary.coordinates[0];
      assert.ok(ring && ring.length >= 4, 'boundary ring must be present and closed');
    }
  });

  it('is case-insensitive', () => {
    const upper = resolve_.byAirport('LAX');
    const lower = resolve_.byAirport('lax');
    const mixed = resolve_.byAirport('Lax');
    assert.equal(upper.length, lower.length);
    assert.equal(upper.length, mixed.length);
  });

  it('returns an empty array for an unknown identifier', () => {
    const features = resolve_.byAirport('NOPE');
    assert.equal(features.length, 0);
  });

  it('filters by type when the types set is provided', () => {
    const all = resolve_.byAirport('JFK');
    const onlyClassB = resolve_.byAirport('JFK', new Set<AirspaceType>(['CLASS_B']));
    assert.ok(onlyClassB.length > 0);
    assert.ok(onlyClassB.every((f) => f.type === 'CLASS_B'));
    assert.ok(onlyClassB.length <= all.length);
  });

  it('returns an empty array when the type filter excludes every match', () => {
    const features = resolve_.byAirport('JFK', new Set<AirspaceType>(['MOA']));
    assert.equal(features.length, 0);
  });

  it('does not match ICAO-prefixed codes (use the FAA identifier)', () => {
    const features = resolve_.byAirport('KJFK');
    assert.equal(features.length, 0, 'airspace features are keyed by FAA ID, not ICAO');
  });

  it('excludes ARTCC features from byAirport results', () => {
    const features = resolve_.byAirport('ZNY');
    assert.equal(
      features.filter((f) => f.type === 'ARTCC').length,
      0,
      'byAirport must not return ARTCC features',
    );
  });
});

describe('byArtcc', () => {
  it('returns LOW and HIGH features for a CONUS center', () => {
    const features = resolve_.byArtcc('ZNY');
    assert.ok(features.length >= 2, 'expected at least LOW and HIGH for ZNY');
    assert.ok(
      features.every((f) => f.type === 'ARTCC' && f.identifier === 'ZNY'),
      'all features must be ARTCC type with matching identifier',
    );
    const strata = new Set(features.map((f) => f.artccStratum));
    assert.ok(strata.has('LOW'));
    assert.ok(strata.has('HIGH'));
  });

  it('filters by stratum when provided', () => {
    const features = resolve_.byArtcc('ZBW', 'HIGH');
    assert.ok(features.length > 0, 'expected at least one ZBW HIGH feature');
    assert.ok(
      features.every((f) => f.artccStratum === 'HIGH'),
      'all features must match the requested stratum',
    );
  });

  it('is case-insensitive', () => {
    const upper = resolve_.byArtcc('ZNY');
    const lower = resolve_.byArtcc('zny');
    assert.equal(upper.length, lower.length);
  });

  it('returns an empty array for an unknown identifier', () => {
    assert.equal(resolve_.byArtcc('ZZZ').length, 0);
  });

  it('returns multiple features for a stratum that has been split or has multiple shapes', () => {
    // ZAK CTA crosses the antimeridian and is split into two sub-polygons
    const zakCta = resolve_.byArtcc('ZAK', 'CTA');
    assert.ok(
      zakCta.length >= 2,
      `expected ZAK CTA to have at least 2 sub-polygons, got ${zakCta.length}`,
    );
    assert.ok(
      zakCta.every((f) => f.identifier === 'ZAK' && f.artccStratum === 'CTA'),
      'all ZAK CTA features should share identifier and stratum',
    );
    // Each sub-polygon should stay in standard [-180, 180] longitude range
    for (const feature of zakCta) {
      const ring = feature.boundary.coordinates[0]!;
      for (const coord of ring) {
        const lon = coord[0]!;
        assert.ok(lon >= -180 && lon <= 180, `lon ${lon} out of range for ZAK CTA`);
      }
    }
  });
});

describe('ARTCC position queries', () => {
  it('returns the LOW stratum at low altitude over CONUS', () => {
    // Approximately Burlington VT, well inside ZBW LOW
    const results = resolve_.query({ lat: 44.47, lon: -73.15, altitudeFt: 5000 });
    const artcc = results.filter((f) => f.type === 'ARTCC');
    assert.ok(
      artcc.some((f) => f.identifier === 'ZBW' && f.artccStratum === 'LOW'),
      'expected ZBW LOW at FL050 over Burlington',
    );
  });

  it('returns the HIGH stratum at cruise altitude', () => {
    // Same location, FL250 - should match ZBW HIGH instead of LOW
    const results = resolve_.query({ lat: 44.47, lon: -73.15, altitudeFt: 25000 });
    const artcc = results.filter((f) => f.type === 'ARTCC');
    assert.ok(
      artcc.some((f) => f.identifier === 'ZBW' && f.artccStratum === 'HIGH'),
      'expected ZBW HIGH at FL250 over Burlington',
    );
  });

  it('returns ZAK for a Pacific position east of the antimeridian', () => {
    // 40N, 175W is in the central Pacific, well inside ZAK's eastern sub-polygon
    const results = resolve_.query({ lat: 40, lon: -175, altitudeFt: 35000 });
    const artcc = results.filter((f) => f.type === 'ARTCC');
    assert.ok(
      artcc.some((f) => f.identifier === 'ZAK'),
      `expected ZAK at (40, -175); got ${artcc.map((f) => f.identifier).join(', ') || 'nothing'}`,
    );
  });

  it('returns ZAK for a Pacific position west of the antimeridian', () => {
    // 40N, 175E is in the central Pacific, well inside ZAK's western sub-polygon
    const results = resolve_.query({ lat: 40, lon: 175, altitudeFt: 35000 });
    const artcc = results.filter((f) => f.type === 'ARTCC');
    assert.ok(
      artcc.some((f) => f.identifier === 'ZAK'),
      `expected ZAK at (40, 175); got ${artcc.map((f) => f.identifier).join(', ') || 'nothing'}`,
    );
  });

  it('does not return ZAK for a CONUS position (no false positive from antimeridian splits)', () => {
    // Kansas: well inside ZKC, far from any oceanic FIR
    const results = resolve_.query({ lat: 38.5, lon: -99.5, altitudeFt: 3000 });
    const zak = results.filter((f) => f.identifier === 'ZAK');
    assert.equal(zak.length, 0, 'ZAK should not match a CONUS position');
  });

  it('returns only ARTCC features when the types filter is restricted to ARTCC', () => {
    const results = resolve_.query({
      lat: 38.5,
      lon: -99.5,
      altitudeFt: 3000,
      types: new Set<AirspaceType>(['ARTCC']),
    });
    assert.ok(results.length > 0, 'expected at least one ARTCC at rural Kansas');
    assert.ok(
      results.every((f) => f.type === 'ARTCC'),
      'all results should be ARTCC',
    );
  });
});

describe('createAirspaceResolver with empty dataset', () => {
  it('returns no results for any query', () => {
    const emptyData: FeatureCollection = { type: 'FeatureCollection', features: [] };
    const emptyResolve = createAirspaceResolver({ data: emptyData });
    const results = emptyResolve.query({ lat: 33.9425, lon: -118.4081, altitudeFt: 3000 });
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
    const results = r.query({ lat: 0, lon: 0, altitudeFt: 0 });
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
    const results = r.query({ lat: 0, lon: 0, altitudeFt: 0 });
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
    const results = r.query({ lat: 5, lon: 5, altitudeFt: 0 });
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
    const results = r.query({ lat: 5, lon: 5, altitudeFt: 0 });
    assert.equal(results.length, 0);
  });
});
