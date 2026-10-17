import type { Position } from 'geojson';
import { describe, it, expect, assert } from 'vitest';

import { usBundledAirspace } from './node.js';

/**
 * Number of decimal places in a number's shortest decimal representation,
 * reading exponent notation (`1.5e-7` has 8).
 */
function decimalPlaces(value: number): number {
  const [mantissa = '', exponent] = String(Math.abs(value)).split('e');
  const fraction = mantissa.split('.')[1] ?? '';
  const shift = exponent === undefined ? 0 : -Number(exponent);
  return Math.max(0, fraction.length + shift);
}

/** The Special Use Airspace types, whose boundaries the build traces from arcs and lines. */
const SUA_TYPES = new Set(['MOA', 'RESTRICTED', 'WARNING', 'ALERT', 'PROHIBITED', 'NSA']);

/**
 * Great-circle distance in nautical miles between two [lon, lat] positions.
 */
function distanceNm(a: Position, b: Position): number {
  const toRad = Math.PI / 180;
  const [lon1 = 0, lat1 = 0] = a;
  const [lon2 = 0, lat2 = 0] = b;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.sqrt(h));
}

/**
 * Twice the signed area of a closed ring in the lon/lat plane; positive when
 * the ring runs counterclockwise.
 */
function signedArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1 = 0, y1 = 0] = ring[i] ?? [];
    const [x2 = 0, y2 = 0] = ring[i + 1] ?? [];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

/**
 * `true` when the open segments a1-a2 and b1-b2 cross.
 */
function segmentsCross(a1: Position, a2: Position, b1: Position, b2: Position): boolean {
  const orient = (p: Position, q: Position, r: Position): number =>
    ((q[0] ?? 0) - (p[0] ?? 0)) * ((r[1] ?? 0) - (p[1] ?? 0)) -
    ((q[1] ?? 0) - (p[1] ?? 0)) * ((r[0] ?? 0) - (p[0] ?? 0));
  return orient(a1, a2, b1) * orient(a1, a2, b2) < 0 && orient(b1, b2, a1) * orient(b1, b2, a2) < 0;
}

/**
 * Counts the pairs of non-adjacent ring segments that cross where both
 * segments are longer than `minSegmentNm`, which separates a mis-traced arc
 * (long chords crossing) from the few-hundred-metre slivers left by the
 * FAA's own arc endpoint rounding.
 */
function longSelfCrossings(ring: Position[], minSegmentNm: number): number {
  const n = ring.length - 1;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const a1 = ring[i];
    const a2 = ring[i + 1];
    if (a1 === undefined || a2 === undefined) {
      continue;
    }
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) {
        continue;
      }
      const b1 = ring[j];
      const b2 = ring[j + 1];
      if (b1 === undefined || b2 === undefined) {
        continue;
      }
      if (
        segmentsCross(a1, a2, b1, b2) &&
        Math.min(distanceNm(a1, a2), distanceNm(b1, b2)) > minSegmentNm
      ) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * The rings of a feature's Polygon geometry.
 */
function ringsOf(feature: (typeof usBundledAirspace.features)[number]): Position[][] {
  if (feature.geometry.type !== 'Polygon') {
    throw new Error(`expected Polygon geometry, got ${feature.geometry.type}`);
  }
  return feature.geometry.coordinates;
}

describe('usBundledAirspace', () => {
  it('loads with a reasonable number of features', () => {
    assert(usBundledAirspace.features.length > 6000);
  });

  it('has metadata with nasrCycleDate, generatedAt, and featureCount', () => {
    assert(usBundledAirspace.properties.generatedAt.length > 0);
    assert(usBundledAirspace.properties.nasrCycleDate.length > 0);
    expect(usBundledAirspace.properties.nasrCycleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(usBundledAirspace.properties.featureCount).toBe(usBundledAirspace.features.length);
  });

  it('is a GeoJSON FeatureCollection', () => {
    expect(usBundledAirspace.type).toBe('FeatureCollection');
    assert(Array.isArray(usBundledAirspace.features));
  });

  it('contains features with Polygon geometry', () => {
    const first = usBundledAirspace.features[0];
    assert(first !== undefined);
    expect(first.type).toBe('Feature');
    if (first.geometry.type !== 'Polygon') {
      throw new Error(`expected Polygon geometry, got ${first.geometry.type}`);
    }
    expect(Array.isArray(first.geometry.coordinates)).toBe(true);
  });

  it('contains features with the expected properties', () => {
    const first = usBundledAirspace.features[0];
    assert(first !== undefined);
    const props = first.properties;
    assert(props !== null);
    expect(typeof props.type).toBe('string');
    expect(typeof props.name).toBe('string');
    expect(typeof props.identifier).toBe('string');
    assert(props.floor !== undefined);
    expect(typeof props.floor.valueFt).toBe('number');
    expect(typeof props.floor.reference).toBe('string');
    assert(props.ceiling !== undefined);
    expect(typeof props.ceiling.valueFt).toBe('number');
    expect(typeof props.ceiling.reference).toBe('string');
  });

  it('includes Class B, C, D, and E airspace', () => {
    const types = new Set(usBundledAirspace.features.map((f) => f.properties?.type));
    assert(types.has('CLASS_B'));
    assert(types.has('CLASS_C'));
    assert(types.has('CLASS_D'));
    assert(types.has('CLASS_E2'));
    assert(types.has('CLASS_E3'));
    assert(types.has('CLASS_E4'));
    assert(types.has('CLASS_E5'));
    assert(types.has('CLASS_E6'));
    assert(types.has('CLASS_E7'));
  });

  it('includes Special Use Airspace types', () => {
    const types = new Set(usBundledAirspace.features.map((f) => f.properties?.type));
    assert(types.has('MOA'));
    assert(types.has('RESTRICTED'));
    assert(types.has('PROHIBITED'));
  });

  it('has altitude bounds with valid references', () => {
    const validRefs = new Set(['MSL', 'AGL', 'SFC']);
    for (const feature of usBundledAirspace.features) {
      const props = feature.properties;
      if (props?.floor) {
        assert(
          validRefs.has(props.floor.reference),
          `Invalid floor reference: ${props.floor.reference}`,
        );
      }
      if (props?.ceiling) {
        assert(
          validRefs.has(props.ceiling.reference),
          `Invalid ceiling reference: ${props.ceiling.reference}`,
        );
      }
    }
  });

  it('can find a known Class B airspace by identifier', () => {
    const jfk = usBundledAirspace.features.find(
      (f) => f.properties?.type === 'CLASS_B' && f.properties.identifier === 'JFK',
    );
    assert(jfk !== undefined);
    assert(jfk.properties !== null);
    assert(jfk.properties.name.includes('NEW YORK'));
    expect(jfk.properties.state).toBe('NY');
  });

  it('can find a known Class E2 airspace by identifier', () => {
    const gnv = usBundledAirspace.features.find(
      (f) => f.properties?.type === 'CLASS_E2' && f.properties.identifier === 'GNV',
    );
    assert(gnv !== undefined);
    assert(gnv.properties !== null);
    assert(gnv.properties.name.includes('GAINESVILLE'));
    expect(gnv.properties.state).toBe('FL');
  });

  it('has valid polygon coordinates', () => {
    const first = usBundledAirspace.features[0];
    assert(first !== undefined);
    if (first.geometry.type !== 'Polygon') {
      throw new Error(`expected Polygon geometry, got ${first.geometry.type}`);
    }
    const ring = first.geometry.coordinates[0];
    assert(ring !== undefined);
    assert(ring.length >= 4, 'Polygon ring must have at least 4 points');
    const firstCoord = ring[0];
    const lastCoord = ring[ring.length - 1];
    assert(firstCoord !== undefined);
    assert(lastCoord !== undefined);
    expect(firstCoord, 'Polygon ring must be closed').toEqual(lastCoord);
  });

  it('includes ARTCC features for the major CONUS centers', () => {
    const artccFeatures = usBundledAirspace.features.filter((f) => f.properties?.type === 'ARTCC');
    assert(
      artccFeatures.length >= 40,
      `expected at least 40 ARTCC features, got ${artccFeatures.length}`,
    );
    const identifiers = new Set(artccFeatures.map((f) => f.properties?.identifier));
    for (const expected of ['ZNY', 'ZBW', 'ZDC', 'ZTL', 'ZAU', 'ZLA', 'ZSE', 'ZAB']) {
      assert(identifiers.has(expected), `missing ARTCC ${expected}`);
    }
  });

  it('emits separate ARTCC features per stratum with the expected bounds', () => {
    const ny = usBundledAirspace.features.filter(
      (f) => f.properties?.type === 'ARTCC' && f.properties.identifier === 'ZNY',
    );
    const strata = new Set(ny.map((f) => f.properties?.artccStratum));
    assert(strata.has('LOW'), 'expected ZNY LOW feature');
    assert(strata.has('HIGH'), 'expected ZNY HIGH feature');

    const low = ny.find((f) => f.properties?.artccStratum === 'LOW');
    assert(low?.properties);
    expect(low.properties.floor.reference).toBe('SFC');
    expect(low.properties.ceiling.valueFt).toBe(18000);

    const high = ny.find((f) => f.properties?.artccStratum === 'HIGH');
    assert(high?.properties);
    expect(high.properties.floor.valueFt).toBe(18000);
    expect(high.properties.ceiling.valueFt).toBe(60000);
  });

  it('includes US oceanic ARTCC strata', () => {
    const oceanic = usBundledAirspace.features.filter(
      (f) =>
        f.properties?.type === 'ARTCC' &&
        ['CTA', 'FIR', 'CTA/FIR', 'UTA'].includes(f.properties.artccStratum ?? ''),
    );
    assert(oceanic.length > 0, 'expected at least one oceanic ARTCC feature');
    const oceanicIds = new Set(oceanic.map((f) => f.properties?.identifier));
    assert(oceanicIds.has('ZAK'), 'expected ZAK Oakland Oceanic');
  });

  it('sets artccStratum to null on non-ARTCC features', () => {
    const sample = usBundledAirspace.features.find((f) => f.properties?.type === 'CLASS_B');
    assert(sample?.properties);
    expect(sample.properties.artccStratum).toBe(null);
  });

  it('sets artccStratum to a recognized value on every ARTCC feature', () => {
    const validStrata = new Set(['LOW', 'HIGH', 'UTA', 'CTA', 'FIR', 'CTA/FIR']);
    const artccFeatures = usBundledAirspace.features.filter((f) => f.properties?.type === 'ARTCC');
    for (const feature of artccFeatures) {
      const stratum = feature.properties?.artccStratum;
      assert(
        stratum !== null && stratum !== undefined,
        `ARTCC ${feature.properties?.identifier} must have a non-null artccStratum`,
      );
      assert(
        validStrata.has(stratum),
        `ARTCC ${feature.properties?.identifier} has unrecognized stratum ${stratum}`,
      );
    }
  });

  it('carries one derived Class A feature per domestic high stratum, with the Class A block', () => {
    const classA = usBundledAirspace.features.filter((f) => f.properties?.type === 'CLASS_A');
    const highStrata = usBundledAirspace.features.filter(
      (f) => f.properties?.type === 'ARTCC' && f.properties.artccStratum === 'HIGH',
    );
    // Every HIGH stratum shape, plus San Juan's single combined stratum.
    expect(classA.length).toBe(highStrata.length + 1);
    for (const feature of classA) {
      assert(feature.properties !== null);
      expect(feature.properties.name).toBe('CLASS A');
      expect(feature.properties.identifier).toBe('');
      expect(feature.properties.floor).toEqual({ valueFt: 18000, reference: 'MSL' });
      expect(feature.properties.ceiling).toEqual({ valueFt: 60000, reference: 'MSL' });
      expect(feature.properties.artccStratum).toBe(null);
    }
  });

  it('closes every ring with at least four positions and no consecutive duplicates', () => {
    for (const feature of usBundledAirspace.features) {
      for (const ring of ringsOf(feature)) {
        const label = `${feature.properties?.type} ${feature.properties?.name}`;
        assert(ring.length >= 4, `${label}: ring with ${ring.length} positions`);
        expect(ring[0], `${label}: ring not closed`).toEqual(ring[ring.length - 1]);
        for (let i = 1; i < ring.length; i++) {
          const previous = ring[i - 1];
          const current = ring[i];
          assert(
            previous?.[0] !== current?.[0] || previous?.[1] !== current?.[1],
            `${label}: duplicate consecutive vertex at ${i}`,
          );
        }
      }
    }
  });

  it('orients exterior rings counterclockwise and holes clockwise', () => {
    let holes = 0;
    for (const feature of usBundledAirspace.features) {
      ringsOf(feature).forEach((ring, index) => {
        const label = `${feature.properties?.type} ${feature.properties?.name} ring ${index}`;
        if (index === 0) {
          assert(signedArea(ring) > 0, `${label}: exterior ring is clockwise`);
        } else {
          holes += 1;
          assert(signedArea(ring) < 0, `${label}: hole is counterclockwise`);
        }
      });
    }
    assert(holes > 10, `expected the known shapefile holes, found ${holes}`);
  });

  it('traces every Special Use Airspace boundary without a crossing between long segments', () => {
    const crossing: string[] = [];
    let checked = 0;
    for (const feature of usBundledAirspace.features) {
      if (!SUA_TYPES.has(feature.properties?.type ?? '')) {
        continue;
      }
      checked += 1;
      const exterior = ringsOf(feature)[0];
      assert(exterior !== undefined);
      const count = longSelfCrossings(exterior, 0.5);
      if (count > 0) {
        crossing.push(`${feature.properties?.name} (${count})`);
      }
    }
    assert(
      checked > 1000,
      `expected more than 1,000 Special Use Airspace features, got ${checked}`,
    );
    expect(crossing, `self-intersecting SUA boundaries:\n  ${crossing.join('\n  ')}`).toEqual([]);
  }, 60_000);

  it('carries no literal <Null> attribute values', () => {
    for (const feature of usBundledAirspace.features) {
      for (const [key, value] of Object.entries(feature.properties ?? {})) {
        assert(
          value !== '<Null>',
          `${feature.properties?.type} ${feature.properties?.name}: ${key} is the <Null> placeholder`,
        );
      }
    }
  });

  it('keeps every ceiling at or below the highest value the FAA publishes', () => {
    for (const feature of usBundledAirspace.features) {
      const ceiling = feature.properties?.ceiling.valueFt ?? 0;
      assert(
        ceiling <= 100_000,
        `${feature.properties?.type} ${feature.properties?.name}: ceiling ${ceiling}`,
      );
    }
  });

  it('publishes an identifier on controlled airspace around an airport', () => {
    // The Lynden and Sault Ste Marie areas belong to Canadian airports and
    // are published without one.
    const airportTypes = new Set([
      'CLASS_B',
      'CLASS_C',
      'CLASS_D',
      'CLASS_E2',
      'CLASS_E3',
      'CLASS_E4',
    ]);
    const empty = usBundledAirspace.features
      .filter((f) => airportTypes.has(f.properties?.type ?? '') && f.properties?.identifier === '')
      .map((f) => f.properties?.name ?? '');
    expect(empty.sort()).toEqual([
      'LYNDEN CLASS D',
      'LYNDEN CLASS D',
      'SAULT STE MARIE CLASS D',
      'SAULT STE MARIE CLASS E4',
    ]);
  });

  it('emits one feature per Special Use Airspace volume', () => {
    const travis = usBundledAirspace.features.filter(
      (f) => f.properties?.name === 'A-682 TRAVIS AFB, CA',
    );
    expect(travis.map((f) => f.properties?.ceiling.valueFt).sort()).toEqual([3000, 6000]);
    const birmingham = usBundledAirspace.features.filter(
      (f) => f.properties?.name === 'BIRMINGHAM 2 MOA, AL',
    );
    expect(birmingham.length).toBe(4);
    for (const feature of birmingham) {
      expect(feature.properties?.identifier).toBe('MBIRMINGH2');
    }
  });

  it('keeps every part of a multipart Class E area', () => {
    const florida = usBundledAirspace.features.filter(
      (f) => f.properties?.name === 'FLORIDA CLASS E5',
    );
    expect(florida.length).toBe(2);
    const keyWest = florida.find((f) => {
      const ring = ringsOf(f)[0] ?? [];
      return ring.every((p) => (p[1] ?? 0) < 25);
    });
    assert(keyWest !== undefined, 'expected the Key West part of the Florida Class E5 area');
  });

  it('publishes the controlling center for most Special Use Airspace and none for controlled airspace', () => {
    let suaWithCenter = 0;
    for (const feature of usBundledAirspace.features) {
      const type = feature.properties?.type ?? '';
      const facility = feature.properties?.controllingFacility ?? null;
      if (SUA_TYPES.has(type)) {
        if (facility !== null) {
          suaWithCenter += 1;
          assert(/^Z[A-Z]{2}$/.test(facility), `unexpected controlling facility ${facility}`);
        }
      } else {
        expect(facility, `${type} ${feature.properties?.name} carries a controlling facility`).toBe(
          null,
        );
      }
    }
    assert(suaWithCenter > 1000, `expected a controlling center on most SUA, got ${suaWithCenter}`);
  });

  it('marks exclusive limits and caps Class E beneath Class A at an exclusive 18,000 ft', () => {
    let exclusiveCeilings = 0;
    let exclusiveFloors = 0;
    let cappedClassE = 0;
    for (const feature of usBundledAirspace.features) {
      const props = feature.properties;
      if (props?.ceiling.inclusive === false) {
        exclusiveCeilings += 1;
        if (props.type.startsWith('CLASS_E')) {
          expect(props.ceiling.valueFt, `${props.name} capped ceiling`).toBe(18000);
          cappedClassE += 1;
        }
      }
      if (props?.floor.inclusive === false) {
        exclusiveFloors += 1;
      }
      // The flag is only ever written as false; absence means inclusive.
      expect(props?.ceiling.inclusive).not.toBe(true);
      expect(props?.floor.inclusive).not.toBe(true);
      // The FAA publishes some SUA ceilings as an inclusive 17,999 ft; only the
      // derived Class E cap must use the exclusive 18,000 form.
      assert(
        !(props?.type.startsWith('CLASS_E') && props.ceiling.valueFt === 17999),
        `${props?.type} ${props?.name}: a Class E 17,999 ft ceiling should be an exclusive 18,000`,
      );
    }
    assert(exclusiveCeilings > 4500, `expected many exclusive ceilings, got ${exclusiveCeilings}`);
    assert(exclusiveFloors > 10, `expected some exclusive floors, got ${exclusiveFloors}`);
    assert(
      cappedClassE > 4000,
      `expected the Class E cap on thousands of areas, got ${cappedClassE}`,
    );
  });

  it('carries the excluded volumes of Special Use Airspace', () => {
    let withExclusions = 0;
    let exclusionCount = 0;
    for (const feature of usBundledAirspace.features) {
      const exclusions = feature.properties?.exclusions;
      if (exclusions === undefined) {
        continue;
      }
      assert(
        SUA_TYPES.has(feature.properties?.type ?? ''),
        `${feature.properties?.type} ${feature.properties?.name} carries exclusions`,
      );
      withExclusions += 1;
      for (const exclusion of exclusions) {
        exclusionCount += 1;
        const ring = exclusion.boundary.coordinates[0];
        assert(ring !== undefined && ring.length >= 4, 'exclusion ring too short');
        expect(ring[0]).toEqual(ring[ring.length - 1]);
        assert(signedArea(ring) > 0, 'exclusion ring is clockwise');
        expect(typeof exclusion.floor.valueFt).toBe('number');
        expect(typeof exclusion.ceiling.valueFt).toBe('number');
      }
    }
    assert(
      withExclusions > 100,
      `expected exclusions on more than 100 features, got ${withExclusions}`,
    );
    assert(exclusionCount > 200, `expected more than 200 exclusion volumes, got ${exclusionCount}`);
    const dothan = usBundledAirspace.features.find((f) => f.properties?.identifier === 'A211');
    assert(dothan?.properties?.exclusions !== undefined, 'expected exclusions on A-211 Dothan');
    expect(dothan.properties.exclusions.length).toBe(4);
  });

  it('keeps the per-type feature counts above their floors', () => {
    const floors: Record<string, number> = {
      CLASS_A: 20,
      CLASS_B: 350,
      CLASS_C: 330,
      CLASS_D: 560,
      CLASS_E2: 500,
      CLASS_E3: 60,
      CLASS_E4: 260,
      CLASS_E5: 3300,
      CLASS_E6: 60,
      CLASS_E7: 70,
      MOA: 500,
      RESTRICTED: 480,
      WARNING: 200,
      ALERT: 35,
      PROHIBITED: 12,
      NSA: 14,
      ARTCC: 60,
    };
    const counts = new Map<string, number>();
    for (const feature of usBundledAirspace.features) {
      const type = feature.properties?.type ?? '';
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    for (const [type, floor] of Object.entries(floors)) {
      assert(
        (counts.get(type) ?? 0) >= floor,
        `${type}: ${counts.get(type) ?? 0} features, floor ${floor}`,
      );
    }
  });

  it('keeps every ARTCC sub-polygon within standard [-180, 180] longitude range', () => {
    const artccFeatures = usBundledAirspace.features.filter((f) => f.properties?.type === 'ARTCC');
    for (const feature of artccFeatures) {
      const ring = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0] : null;
      assert(ring, `ARTCC ${feature.properties?.identifier} must have a polygon ring`);
      for (const coord of ring) {
        const lon = coord[0]!;
        assert(
          lon >= -180 && lon <= 180,
          `ARTCC ${feature.properties?.identifier} ${feature.properties?.artccStratum} has out-of-range lon ${lon}`,
        );
      }
    }
  });
});

describe('coordinate precision', () => {
  it('carries at most 5 decimal places on boundary and exclusion vertices', () => {
    let most = 0;
    const measure = (rings: Position[][]): void => {
      for (const ring of rings) {
        for (const [lon, lat] of ring) {
          most = Math.max(most, decimalPlaces(lon ?? 0), decimalPlaces(lat ?? 0));
        }
      }
    };
    for (const feature of usBundledAirspace.features) {
      measure(ringsOf(feature));
      for (const exclusion of feature.properties?.exclusions ?? []) {
        measure(exclusion.boundary.coordinates);
      }
    }
    assert(most <= 5, `found a coordinate with ${most} decimal places`);
  });
});
