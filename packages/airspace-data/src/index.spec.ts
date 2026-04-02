import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { usBundledAirspace } from './index.js';

describe('usBundledAirspace', () => {
  it('loads with a reasonable number of features', () => {
    assert.ok(usBundledAirspace.features.length > 2000);
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

  it('includes Class B, C, and D airspace', () => {
    const types = new Set(usBundledAirspace.features.map((f) => f.properties?.type));
    assert.ok(types.has('CLASS_B'));
    assert.ok(types.has('CLASS_C'));
    assert.ok(types.has('CLASS_D'));
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
});
