import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { usBundledAirspace } from './index.js';

describe('usBundledAirspace', () => {
  it('loads with a reasonable number of features', () => {
    assert.ok(usBundledAirspace.features.length > 6000);
  });

  it('has metadata with nasrCycleDate, generatedAt, and featureCount', () => {
    assert.ok(usBundledAirspace.properties.generatedAt.length > 0);
    assert.ok(usBundledAirspace.properties.nasrCycleDate.length > 0);
    assert.match(usBundledAirspace.properties.nasrCycleDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(usBundledAirspace.properties.featureCount, usBundledAirspace.features.length);
  });

  it('is a GeoJSON FeatureCollection', () => {
    assert.equal(usBundledAirspace.type, 'FeatureCollection');
    assert.ok(Array.isArray(usBundledAirspace.features));
  });

  it('contains features with Polygon geometry', () => {
    const first = usBundledAirspace.features[0];
    assert.ok(first !== undefined);
    assert.equal(first.type, 'Feature');
    assert.equal(first.geometry.type, 'Polygon');
    assert.ok(Array.isArray(first.geometry.coordinates));
  });

  it('contains features with the expected properties', () => {
    const first = usBundledAirspace.features[0];
    assert.ok(first !== undefined);
    const props = first.properties;
    assert.ok(props !== null);
    assert.equal(typeof props.type, 'string');
    assert.equal(typeof props.name, 'string');
    assert.equal(typeof props.identifier, 'string');
    assert.ok(props.floor !== undefined);
    assert.equal(typeof props.floor.valueFt, 'number');
    assert.equal(typeof props.floor.reference, 'string');
    assert.ok(props.ceiling !== undefined);
    assert.equal(typeof props.ceiling.valueFt, 'number');
    assert.equal(typeof props.ceiling.reference, 'string');
  });

  it('includes Class B, C, D, and E airspace', () => {
    const types = new Set(usBundledAirspace.features.map((f) => f.properties?.type));
    assert.ok(types.has('CLASS_B'));
    assert.ok(types.has('CLASS_C'));
    assert.ok(types.has('CLASS_D'));
    assert.ok(types.has('CLASS_E2'));
    assert.ok(types.has('CLASS_E3'));
    assert.ok(types.has('CLASS_E4'));
    assert.ok(types.has('CLASS_E5'));
    assert.ok(types.has('CLASS_E6'));
    assert.ok(types.has('CLASS_E7'));
  });

  it('includes Special Use Airspace types', () => {
    const types = new Set(usBundledAirspace.features.map((f) => f.properties?.type));
    assert.ok(types.has('MOA'));
    assert.ok(types.has('RESTRICTED'));
    assert.ok(types.has('PROHIBITED'));
  });

  it('has altitude bounds with valid references', () => {
    const validRefs = new Set(['MSL', 'AGL', 'SFC']);
    for (const feature of usBundledAirspace.features) {
      const props = feature.properties;
      if (props?.floor) {
        assert.ok(
          validRefs.has(props.floor.reference),
          `Invalid floor reference: ${props.floor.reference}`,
        );
      }
      if (props?.ceiling) {
        assert.ok(
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
    assert.ok(jfk !== undefined);
    assert.ok(jfk.properties !== null);
    assert.ok(jfk.properties.name.includes('NEW YORK'));
    assert.equal(jfk.properties.state, 'NY');
  });

  it('can find a known Class E2 airspace by identifier', () => {
    const gnv = usBundledAirspace.features.find(
      (f) => f.properties?.type === 'CLASS_E2' && f.properties.identifier === 'GNV',
    );
    assert.ok(gnv !== undefined);
    assert.ok(gnv.properties !== null);
    assert.ok(gnv.properties.name.includes('GAINESVILLE'));
    assert.equal(gnv.properties.state, 'FL');
  });

  it('has valid polygon coordinates', () => {
    const first = usBundledAirspace.features[0];
    assert.ok(first !== undefined);
    assert.equal(first.geometry.type, 'Polygon');
    const ring = first.geometry.coordinates[0];
    assert.ok(ring !== undefined);
    assert.ok(ring.length >= 4, 'Polygon ring must have at least 4 points');
    const firstCoord = ring[0];
    const lastCoord = ring[ring.length - 1];
    assert.ok(firstCoord !== undefined);
    assert.ok(lastCoord !== undefined);
    assert.deepEqual(firstCoord, lastCoord, 'Polygon ring must be closed');
  });

  it('includes ARTCC features for the major CONUS centers', () => {
    const artccFeatures = usBundledAirspace.features.filter((f) => f.properties?.type === 'ARTCC');
    assert.ok(
      artccFeatures.length >= 40,
      `expected at least 40 ARTCC features, got ${artccFeatures.length}`,
    );
    const identifiers = new Set(artccFeatures.map((f) => f.properties?.identifier));
    for (const expected of ['ZNY', 'ZBW', 'ZDC', 'ZTL', 'ZAU', 'ZLA', 'ZSE', 'ZAB']) {
      assert.ok(identifiers.has(expected), `missing ARTCC ${expected}`);
    }
  });

  it('emits separate ARTCC features per stratum with the expected bounds', () => {
    const ny = usBundledAirspace.features.filter(
      (f) => f.properties?.type === 'ARTCC' && f.properties.identifier === 'ZNY',
    );
    const strata = new Set(ny.map((f) => f.properties?.artccStratum));
    assert.ok(strata.has('LOW'), 'expected ZNY LOW feature');
    assert.ok(strata.has('HIGH'), 'expected ZNY HIGH feature');

    const low = ny.find((f) => f.properties?.artccStratum === 'LOW');
    assert.ok(low?.properties);
    assert.equal(low.properties.floor.reference, 'SFC');
    assert.equal(low.properties.ceiling.valueFt, 18000);

    const high = ny.find((f) => f.properties?.artccStratum === 'HIGH');
    assert.ok(high?.properties);
    assert.equal(high.properties.floor.valueFt, 18000);
    assert.equal(high.properties.ceiling.valueFt, 60000);
  });

  it('includes US oceanic ARTCC strata', () => {
    const oceanic = usBundledAirspace.features.filter(
      (f) =>
        f.properties?.type === 'ARTCC' &&
        ['CTA', 'FIR', 'CTA/FIR', 'UTA'].includes(f.properties.artccStratum ?? ''),
    );
    assert.ok(oceanic.length > 0, 'expected at least one oceanic ARTCC feature');
    const oceanicIds = new Set(oceanic.map((f) => f.properties?.identifier));
    assert.ok(oceanicIds.has('ZAK'), 'expected ZAK Oakland Oceanic');
  });

  it('sets artccStratum to null on non-ARTCC features', () => {
    const sample = usBundledAirspace.features.find((f) => f.properties?.type === 'CLASS_B');
    assert.ok(sample?.properties);
    assert.equal(sample.properties.artccStratum, null);
  });

  it('sets artccStratum to a recognized value on every ARTCC feature', () => {
    const validStrata = new Set(['LOW', 'HIGH', 'UTA', 'CTA', 'FIR', 'CTA/FIR']);
    const artccFeatures = usBundledAirspace.features.filter((f) => f.properties?.type === 'ARTCC');
    for (const feature of artccFeatures) {
      const stratum = feature.properties?.artccStratum;
      assert.ok(
        stratum !== null && stratum !== undefined,
        `ARTCC ${feature.properties?.identifier} must have a non-null artccStratum`,
      );
      assert.ok(
        validStrata.has(stratum),
        `ARTCC ${feature.properties?.identifier} has unrecognized stratum ${stratum}`,
      );
    }
  });

  it('keeps every ARTCC sub-polygon within standard [-180, 180] longitude range', () => {
    const artccFeatures = usBundledAirspace.features.filter((f) => f.properties?.type === 'ARTCC');
    for (const feature of artccFeatures) {
      const ring = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0] : null;
      assert.ok(ring, `ARTCC ${feature.properties?.identifier} must have a polygon ring`);
      for (const coord of ring) {
        const lon = coord[0]!;
        assert.ok(
          lon >= -180 && lon <= 180,
          `ARTCC ${feature.properties?.identifier} ${feature.properties?.artccStratum} has out-of-range lon ${lon}`,
        );
      }
    }
  });
});
