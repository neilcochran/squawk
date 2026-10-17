import { describe, it, expect, assert } from 'vitest';

import { usBundledRegistry } from './node.js';

describe('usBundledRegistry', () => {
  it('loads with a reasonable number of records', () => {
    assert(usBundledRegistry.records.length > 200_000);
  });

  it('has metadata with generatedAt and recordCount', () => {
    assert(usBundledRegistry.properties.generatedAt.length > 0);
    expect(usBundledRegistry.properties.recordCount).toBe(usBundledRegistry.records.length);
  });

  it('contains records with the expected shape', () => {
    const first = usBundledRegistry.records[0];
    assert(first !== undefined);
    expect(typeof first.icaoHex).toBe('string');
    expect(typeof first.registration).toBe('string');
    assert(first.icaoHex.length > 0);
    assert(first.registration.startsWith('N'));
  });

  it('contains records with optional fields populated', () => {
    const withMake = usBundledRegistry.records.find((r) => r.make !== undefined);
    assert(withMake !== undefined);
    expect(typeof withMake.make).toBe('string');

    const withModel = usBundledRegistry.records.find((r) => r.model !== undefined);
    assert(withModel !== undefined);

    const withType = usBundledRegistry.records.find((r) => r.aircraftType !== undefined);
    assert(withType !== undefined);

    const withEngine = usBundledRegistry.records.find((r) => r.engineType !== undefined);
    assert(withEngine !== undefined);
  });

  it('gives every record a registration status, nearly all of them valid', () => {
    const counts = new Map<string, number>();
    for (const record of usBundledRegistry.records) {
      assert(
        record.registrationStatus !== undefined,
        `${record.registration} has no registration status`,
      );
      counts.set(record.registrationStatus, (counts.get(record.registrationStatus) ?? 0) + 1);
    }
    const valid = counts.get('valid') ?? 0;
    assert(valid / usBundledRegistry.records.length > 0.95, `valid registrations: ${valid}`);
    assert((counts.get('registrationPending') ?? 0) > 0, 'expected pending registrations');
    assert((counts.get('saleReported') ?? 0) > 0, 'expected sale-reported registrations');
    assert((counts.get('revoked') ?? 0) > 0, 'expected revoked registrations');
  });

  it('publishes expiration dates as ISO calendar dates on most records', () => {
    const isoDate = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    let dated = 0;
    for (const record of usBundledRegistry.records) {
      if (record.registrationExpirationDate !== undefined) {
        dated++;
        assert(
          isoDate.test(record.registrationExpirationDate),
          `${record.registration}: ${record.registrationExpirationDate}`,
        );
      }
    }
    assert(dated / usBundledRegistry.records.length > 0.9, `dated records: ${dated}`);
  });

  it('never ships an FAA placeholder name as the operator', () => {
    const placeholder = usBundledRegistry.records.find(
      (r) => r.operator === 'REGISTRATION PENDING' || r.operator === 'SALE REPORTED',
    );
    expect(placeholder, 'placeholder registrant names should not become operators').toBe(undefined);
    const saleReported = usBundledRegistry.records.filter(
      (r) => r.registrationStatus === 'saleReported',
    );
    assert(saleReported.some((r) => r.operator === undefined));
  });

  it('ships no year of manufacture of 0', () => {
    for (const record of usBundledRegistry.records) {
      if (record.yearManufactured !== undefined) {
        assert(
          record.yearManufactured >= 1900,
          `${record.registration}: year ${record.yearManufactured}`,
        );
      }
    }
  });

  it('classifies the aircraft type of nearly every record, including the other category', () => {
    const typed = usBundledRegistry.records.filter((r) => r.aircraftType !== undefined).length;
    assert(typed / usBundledRegistry.records.length > 0.9999, `typed records: ${typed}`);
    assert(usBundledRegistry.records.some((r) => r.aircraftType === 'other'));
  });

  it('carries the make, model and engine type on every record', () => {
    for (const record of usBundledRegistry.records) {
      assert(record.make !== undefined, `${record.registration} has no make`);
      assert(record.model !== undefined, `${record.registration} has no model`);
      assert(record.engineType !== undefined, `${record.registration} has no engine type`);
    }
  });

  it('holds one record per ICAO address, all in the US block', () => {
    const seen = new Set<string>();
    for (const record of usBundledRegistry.records) {
      assert(/^A[0-9A-F]{5}$/.test(record.icaoHex), `unexpected ICAO address ${record.icaoHex}`);
      assert(!seen.has(record.icaoHex), `duplicate ICAO address ${record.icaoHex}`);
      seen.add(record.icaoHex);
    }
  });

  it('can look up a known ICAO hex by scanning records', () => {
    const n100 = usBundledRegistry.records.find((r) => r.icaoHex === 'A004B3');
    assert(n100 !== undefined);
    expect(n100.registration).toBe('N100');
  });
});
