import { describe, it, expect, assert } from 'vitest';

import { usBundledAirspace } from './index.js';

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
