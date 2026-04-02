import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { usBundledAirports } from './index.js';

describe('usBundledAirports', () => {
  it('loads with a reasonable number of records', () => {
    assert.ok(usBundledAirports.records.length > 15_000);
  });

  it('has metadata with generatedAt, nasrCycleDate, and recordCount', () => {
    assert.ok(usBundledAirports.properties.generatedAt.length > 0);
    assert.ok(usBundledAirports.properties.nasrCycleDate.length > 0);
    assert.match(usBundledAirports.properties.nasrCycleDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(usBundledAirports.properties.recordCount, usBundledAirports.records.length);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledAirports.records[0];
    assert.ok(first !== undefined);
    assert.equal(typeof first.faaId, 'string');
    assert.equal(typeof first.name, 'string');
    assert.equal(typeof first.facilityType, 'string');
    assert.equal(typeof first.ownershipType, 'string');
    assert.equal(typeof first.useType, 'string');
    assert.equal(typeof first.status, 'string');
    assert.equal(typeof first.city, 'string');
    assert.equal(typeof first.state, 'string');
    assert.equal(typeof first.lat, 'number');
    assert.equal(typeof first.lon, 'number');
    assert.ok(Array.isArray(first.runways));
    assert.ok(Array.isArray(first.frequencies));
  });

  it('contains records with optional fields populated', () => {
    const withIcao = usBundledAirports.records.find((r) => r.icao !== undefined);
    assert.ok(withIcao !== undefined);
    assert.ok(withIcao.icao !== undefined);
    assert.ok(withIcao.icao.startsWith('K'));

    const withElev = usBundledAirports.records.find((r) => r.elevationFt !== undefined);
    assert.ok(withElev !== undefined);
    assert.equal(typeof withElev.elevationFt, 'number');

    const withFuel = usBundledAirports.records.find((r) => r.fuelTypes !== undefined);
    assert.ok(withFuel !== undefined);
    assert.equal(typeof withFuel.fuelTypes, 'string');
  });

  it('includes all facility types', () => {
    const types = new Set(usBundledAirports.records.map((r) => r.facilityType));
    assert.ok(types.has('AIRPORT'));
    assert.ok(types.has('HELIPORT'));
    assert.ok(types.has('SEAPLANE_BASE'));
  });

  it('only contains open facilities', () => {
    const allOpen = usBundledAirports.records.every((r) => r.status === 'OPEN');
    assert.ok(allOpen);
  });

  it('can look up a known airport by ICAO code', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert.ok(jfk !== undefined);
    assert.equal(jfk.faaId, 'JFK');
    assert.equal(jfk.name, 'JOHN F KENNEDY INTL');
    assert.equal(jfk.state, 'NY');
    assert.equal(jfk.facilityType, 'AIRPORT');
    assert.ok(jfk.runways.length >= 4);
    assert.ok(jfk.frequencies.length > 0);
  });

  it('has runways with expected structure', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert.ok(jfk !== undefined);
    const rwy = jfk.runways[0];
    assert.ok(rwy !== undefined);
    assert.equal(typeof rwy.id, 'string');
    assert.ok(rwy.lengthFt !== undefined);
    assert.ok(rwy.widthFt !== undefined);
    assert.ok(rwy.lengthFt > 0);
    assert.ok(rwy.widthFt > 0);
    assert.ok(rwy.ends.length === 2);
  });

  it('has runway ends with expected structure', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert.ok(jfk !== undefined);
    const rwy = jfk.runways[0];
    assert.ok(rwy !== undefined);
    const end = rwy.ends[0];
    assert.ok(end !== undefined);
    assert.equal(typeof end.id, 'string');
    assert.ok(end.trueHeading !== undefined);
    assert.ok(end.trueHeading >= 0 && end.trueHeading <= 360);
    assert.equal(typeof end.lat, 'number');
    assert.equal(typeof end.lon, 'number');
  });

  it('has frequencies with expected structure', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert.ok(jfk !== undefined);
    const freq = jfk.frequencies[0];
    assert.ok(freq !== undefined);
    assert.equal(typeof freq.frequencyMhz, 'number');
    assert.equal(typeof freq.use, 'string');
    assert.ok(freq.frequencyMhz > 0);
  });
});
