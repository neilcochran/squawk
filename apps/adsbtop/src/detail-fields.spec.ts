import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { buildDetailFields } from './detail-fields.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

function fieldValue(
  fields: ReturnType<typeof buildDetailFields>,
  label: string,
): string | undefined {
  return fields.find((field) => field.label === label)?.value;
}

describe('buildDetailFields', () => {
  it('shows "-" for every unpopulated field', () => {
    const fields = buildDetailFields(makeAircraft(), 0);

    expect(fieldValue(fields, 'Callsign')).toBe('-');
    expect(fieldValue(fields, 'Squawk')).toBe('-');
    expect(fieldValue(fields, 'Registration')).toBe('-');
    expect(fieldValue(fields, 'Position')).toBe('-');
    expect(fieldValue(fields, 'Baro altitude')).toBe('-');
    expect(fieldValue(fields, 'Geo altitude')).toBe('-');
    expect(fieldValue(fields, 'Indicated airspeed')).toBe('-');
    expect(fieldValue(fields, 'True airspeed')).toBe('-');
    expect(fieldValue(fields, 'True track')).toBe('-');
    expect(fieldValue(fields, 'Magnetic heading')).toBe('-');
    expect(fieldValue(fields, 'Category')).toBe('-');
    expect(fieldValue(fields, 'Origin')).toBe('-');
    expect(fieldValue(fields, 'Destination')).toBe('-');
  });

  it('formats the ICAO hex and last-seen age', () => {
    const fields = buildDetailFields(makeAircraft({ icaoHex: 'A0B1C2', lastSeenAt: 1000 }), 4000);

    expect(fieldValue(fields, 'ICAO')).toBe('A0B1C2');
    expect(fieldValue(fields, 'Last seen')).toBe('3s ago');
  });

  it('formats position as lat, lon with fixed precision', () => {
    const fields = buildDetailFields(
      makeAircraft({ position: { lat: 40.64131, lon: -73.77812 } }),
      0,
    );

    expect(fieldValue(fields, 'Position')).toBe('40.6413, -73.7781');
  });

  it('formats baro and geo altitude independently, without collapsing them', () => {
    const fields = buildDetailFields(
      makeAircraft({ position: { lat: 0, lon: 0, baroAltitudeFt: 35000, geoAltitudeFt: 35200 } }),
      0,
    );

    expect(fieldValue(fields, 'Baro altitude')).toBe('35000ft');
    expect(fieldValue(fields, 'Geo altitude')).toBe('35200ft');
  });

  it('formats true track and magnetic heading independently, without collapsing them', () => {
    const fields = buildDetailFields(
      makeAircraft({ trueTrackDeg: 90.4, magneticHeadingDeg: 95.6 }),
      0,
    );

    expect(fieldValue(fields, 'True track')).toBe('90°');
    expect(fieldValue(fields, 'Magnetic heading')).toBe('96°');
  });

  it('formats registration with make and model when present', () => {
    const fields = buildDetailFields(
      makeAircraft({
        registration: { icaoHex: 'A0B1C2', registration: 'N12345', make: 'Cessna', model: '172' },
      }),
      0,
    );

    expect(fieldValue(fields, 'Registration')).toBe('N12345 Cessna 172');
  });

  it('formats registration with just the N-number when make/model are unknown', () => {
    const fields = buildDetailFields(
      makeAircraft({ registration: { icaoHex: 'A0B1C2', registration: 'N12345' } }),
      0,
    );

    expect(fieldValue(fields, 'Registration')).toBe('N12345');
  });
});
