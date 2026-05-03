import { describe, it, expect, assert } from 'vitest';

import type { IlsSystem } from '@squawk/types';

import { usBundledAirports } from './index.js';

describe('usBundledAirports', () => {
  it('loads with a reasonable number of records', () => {
    assert(usBundledAirports.records.length > 15_000);
  });

  it('has metadata with generatedAt, nasrCycleDate, and recordCount', () => {
    assert(usBundledAirports.properties.generatedAt.length > 0);
    assert(usBundledAirports.properties.nasrCycleDate.length > 0);
    expect(usBundledAirports.properties.nasrCycleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(usBundledAirports.properties.recordCount).toBe(usBundledAirports.records.length);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledAirports.records[0];
    assert(first !== undefined);
    expect(typeof first.faaId).toBe('string');
    expect(typeof first.name).toBe('string');
    expect(typeof first.facilityType).toBe('string');
    expect(typeof first.ownershipType).toBe('string');
    expect(typeof first.useType).toBe('string');
    expect(typeof first.status).toBe('string');
    expect(typeof first.city).toBe('string');
    expect(typeof first.country).toBe('string');
    expect(typeof first.lat).toBe('number');
    expect(typeof first.lon).toBe('number');
    expect(typeof first.timezone).toBe('string');
    assert(first.timezone.length > 0);
    assert(Array.isArray(first.runways));
    assert(Array.isArray(first.frequencies));
  });

  it('populates an IANA timezone on every record', () => {
    for (const apt of usBundledAirports.records) {
      assert(
        typeof apt.timezone === 'string' && apt.timezone.length > 0,
        `airport ${apt.faaId} is missing a timezone`,
      );
      assert(
        apt.timezone.includes('/'),
        `airport ${apt.faaId} timezone "${apt.timezone}" is not in IANA form`,
      );
    }
  });

  it('resolves expected IANA timezones for well-known airports', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    expect(jfk?.timezone).toBe('America/New_York');

    const lax = usBundledAirports.records.find((r) => r.icao === 'KLAX');
    expect(lax?.timezone).toBe('America/Los_Angeles');

    const hnl = usBundledAirports.records.find((r) => r.icao === 'PHNL');
    expect(hnl?.timezone).toBe('Pacific/Honolulu');

    const anc = usBundledAirports.records.find((r) => r.icao === 'PANC');
    expect(anc?.timezone).toBe('America/Anchorage');
  });

  it('resolves expected IANA timezones for US territories and foreign airports', () => {
    const sanJuan = usBundledAirports.records.find((r) => r.icao === 'TJSJ');
    expect(sanJuan?.timezone).toBe('America/Puerto_Rico');

    const guam = usBundledAirports.records.find((r) => r.icao === 'PGUM');
    expect(guam?.timezone).toBe('Pacific/Guam');

    const toronto = usBundledAirports.records.find((r) => r.icao === 'CYYZ');
    expect(toronto?.country).toBe('CA');
    expect(toronto?.timezone).toBe('America/Toronto');
  });

  it('populates state for US facilities', () => {
    const us = usBundledAirports.records.find((r) => r.country === 'US');
    assert(us !== undefined);
    expect(typeof us.state).toBe('string');
    assert(us.state && us.state.length > 0);
  });

  it('includes foreign facilities that the FAA publishes (e.g. Canadian airports)', () => {
    const foreign = usBundledAirports.records.filter((r) => r.country !== 'US');
    assert(foreign.length > 0, 'expected at least one foreign airport');

    const canadian = usBundledAirports.records.find((r) => r.country === 'CA');
    assert(canadian !== undefined, 'expected at least one Canadian airport');
    expect(canadian.state, 'non-US facilities should have no state').toBe(undefined);
  });

  it('contains records with optional fields populated', () => {
    const withIcao = usBundledAirports.records.find((r) => r.icao !== undefined);
    assert(withIcao !== undefined);
    assert(withIcao.icao !== undefined);
    assert(withIcao.icao.startsWith('K'));

    const withElev = usBundledAirports.records.find((r) => r.elevationFt !== undefined);
    assert(withElev !== undefined);
    expect(typeof withElev.elevationFt).toBe('number');

    const withFuel = usBundledAirports.records.find((r) => r.fuelTypes !== undefined);
    assert(withFuel !== undefined);
    expect(typeof withFuel.fuelTypes).toBe('string');
  });

  it('includes all facility types', () => {
    const types = new Set(usBundledAirports.records.map((r) => r.facilityType));
    assert(types.has('AIRPORT'));
    assert(types.has('HELIPORT'));
    assert(types.has('SEAPLANE_BASE'));
  });

  it('only contains open facilities', () => {
    const allOpen = usBundledAirports.records.every((r) => r.status === 'OPEN');
    assert(allOpen);
  });

  it('can look up a known airport by ICAO code', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert(jfk !== undefined);
    expect(jfk.faaId).toBe('JFK');
    expect(jfk.name).toBe('JOHN F KENNEDY INTL');
    expect(jfk.state).toBe('NY');
    expect(jfk.facilityType).toBe('AIRPORT');
    assert(jfk.runways.length >= 4);
    assert(jfk.frequencies.length > 0);
  });

  it('has runways with expected structure', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert(jfk !== undefined);
    const rwy = jfk.runways[0];
    assert(rwy !== undefined);
    expect(typeof rwy.id).toBe('string');
    assert(rwy.lengthFt !== undefined);
    assert(rwy.widthFt !== undefined);
    assert(rwy.lengthFt > 0);
    assert(rwy.widthFt > 0);
    assert(rwy.ends.length === 2);
  });

  it('has runway ends with expected structure', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert(jfk !== undefined);
    const rwy = jfk.runways[0];
    assert(rwy !== undefined);
    const end = rwy.ends[0];
    assert(end !== undefined);
    expect(typeof end.id).toBe('string');
    assert(end.trueHeadingDeg !== undefined);
    assert(end.trueHeadingDeg >= 0 && end.trueHeadingDeg <= 360);
    expect(typeof end.lat).toBe('number');
    expect(typeof end.lon).toBe('number');
  });

  it('has frequencies with expected structure', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert(jfk !== undefined);
    const freq = jfk.frequencies[0];
    assert(freq !== undefined);
    expect(typeof freq.frequencyMhz).toBe('number');
    expect(typeof freq.use).toBe('string');
    assert(freq.frequencyMhz > 0);
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
    assert(ilsCount > 1000, `expected >1000 ILS systems, got ${ilsCount}`);
  });

  it('has ILS data with expected structure on JFK runway ends', () => {
    const jfk = usBundledAirports.records.find((r) => r.icao === 'KJFK');
    assert(jfk !== undefined);

    const ilsEnds: { id: string; ils: IlsSystem }[] = [];
    for (const rwy of jfk.runways) {
      for (const end of rwy.ends) {
        if (end.ils) {
          ilsEnds.push({ id: end.id, ils: end.ils });
        }
      }
    }

    assert(
      ilsEnds.length >= 4,
      `expected JFK to have >=4 ILS-equipped runway ends, got ${ilsEnds.length}`,
    );

    for (const { ils } of ilsEnds) {
      expect(typeof ils.systemType).toBe('string');
      assert(ils.systemType.length > 0);
      assert(ils.localizerFrequencyMhz !== undefined);
      assert(
        ils.localizerFrequencyMhz >= 108 && ils.localizerFrequencyMhz <= 112,
        `localizer frequency ${ils.localizerFrequencyMhz} outside 108-112 MHz range`,
      );
      assert(ils.localizerMagneticCourseDeg !== undefined);
      assert(ils.localizerMagneticCourseDeg >= 0 && ils.localizerMagneticCourseDeg <= 360);
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
    assert(types.has('ILS'), 'expected ILS system type');
    assert(types.has('ILS/DME'), 'expected ILS/DME system type');
    assert(types.has('LOCALIZER'), 'expected LOCALIZER system type');
    assert(types.has('LOC/DME'), 'expected LOC/DME system type');
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
    assert(ilsWithGs > 100, `expected >100 ILS with glide slope, got ${ilsWithGs}`);
    assert(ilsDmeWithGs > 100, `expected >100 ILS/DME with glide slope, got ${ilsDmeWithGs}`);
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
    assert(
      ilsDmeWithChannel > 100,
      `expected >100 ILS/DME with DME channel, got ${ilsDmeWithChannel}`,
    );
  });
});
