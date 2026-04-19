import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { IlsSystem } from '@squawk/types';
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
    assert.equal(typeof first.country, 'string');
    assert.equal(typeof first.lat, 'number');
    assert.equal(typeof first.lon, 'number');
    assert.ok(Array.isArray(first.runways));
    assert.ok(Array.isArray(first.frequencies));
  });

  it('populates state for US facilities', () => {
    const us = usBundledAirports.records.find((r) => r.country === 'US');
    assert.ok(us !== undefined);
    assert.equal(typeof us.state, 'string');
    assert.ok(us.state && us.state.length > 0);
  });

  it('includes foreign facilities that the FAA publishes (e.g. Canadian airports)', () => {
    const foreign = usBundledAirports.records.filter((r) => r.country !== 'US');
    assert.ok(foreign.length > 0, 'expected at least one foreign airport');

    const canadian = usBundledAirports.records.find((r) => r.country === 'CA');
    assert.ok(canadian !== undefined, 'expected at least one Canadian airport');
    assert.equal(canadian.state, undefined, 'non-US facilities should have no state');
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
    assert.ok(end.trueHeadingDeg !== undefined);
    assert.ok(end.trueHeadingDeg >= 0 && end.trueHeadingDeg <= 360);
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

  it('has a reasonable number of runway ends with ILS data', () => {
    let ilsCount = 0;
    for (const apt of usBundledAirports.records) {
      for (const rwy of apt.runways) {
        for (const end of rwy.ends) {
          if (end.ils) {
            ilsCount++;
          }
        }
      }
    }
    assert.ok(ilsCount > 1000, `expected >1000 ILS systems, got ${ilsCount}`);
  });

  it('has ILS data with expected structure on JFK runway ends', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert.ok(jfk !== undefined);

    const ilsEnds: { id: string; ils: IlsSystem }[] = [];
    for (const rwy of jfk.runways) {
      for (const end of rwy.ends) {
        if (end.ils) {
          ilsEnds.push({ id: end.id, ils: end.ils });
        }
      }
    }

    assert.ok(
      ilsEnds.length >= 4,
      `expected JFK to have >=4 ILS-equipped runway ends, got ${ilsEnds.length}`,
    );

    for (const { ils } of ilsEnds) {
      assert.equal(typeof ils.systemType, 'string');
      assert.ok(ils.systemType.length > 0);
      assert.ok(ils.localizerFrequencyMhz !== undefined);
      assert.ok(
        ils.localizerFrequencyMhz >= 108 && ils.localizerFrequencyMhz <= 112,
        `localizer frequency ${ils.localizerFrequencyMhz} outside 108-112 MHz range`,
      );
      assert.ok(ils.localizerMagneticCourseDeg !== undefined);
      assert.ok(ils.localizerMagneticCourseDeg >= 0 && ils.localizerMagneticCourseDeg <= 360);
    }
  });

  it('has ILS systems across multiple system types', () => {
    const types = new Set<string>();
    for (const apt of usBundledAirports.records) {
      for (const rwy of apt.runways) {
        for (const end of rwy.ends) {
          if (end.ils) {
            types.add(end.ils.systemType);
          }
        }
      }
    }
    assert.ok(types.has('ILS'), 'expected ILS system type');
    assert.ok(types.has('ILS/DME'), 'expected ILS/DME system type');
    assert.ok(types.has('LOCALIZER'), 'expected LOCALIZER system type');
    assert.ok(types.has('LOC/DME'), 'expected LOC/DME system type');
  });

  it('has ILS with glide slope data where expected', () => {
    let ilsWithGs = 0;
    let ilsDmeWithGs = 0;
    for (const apt of usBundledAirports.records) {
      for (const rwy of apt.runways) {
        for (const end of rwy.ends) {
          if (end.ils && end.ils.glideSlopeAngleDeg !== undefined) {
            if (end.ils.systemType === 'ILS') {
              ilsWithGs++;
            } else if (end.ils.systemType === 'ILS/DME') {
              ilsDmeWithGs++;
            }
          }
        }
      }
    }
    assert.ok(ilsWithGs > 100, `expected >100 ILS with glide slope, got ${ilsWithGs}`);
    assert.ok(ilsDmeWithGs > 100, `expected >100 ILS/DME with glide slope, got ${ilsDmeWithGs}`);
  });

  it('has ILS with DME channel data where expected', () => {
    let ilsDmeWithChannel = 0;
    for (const apt of usBundledAirports.records) {
      for (const rwy of apt.runways) {
        for (const end of rwy.ends) {
          if (end.ils && end.ils.systemType === 'ILS/DME' && end.ils.dmeChannel) {
            ilsDmeWithChannel++;
          }
        }
      }
    }
    assert.ok(
      ilsDmeWithChannel > 100,
      `expected >100 ILS/DME with DME channel, got ${ilsDmeWithChannel}`,
    );
  });
});
