import { describe, expect, it, vi } from 'vitest';

import {
  aircraftDetailsUrl,
  fetchAircraftDetails,
  parseAircraftDetails,
} from './aircraft-details.js';

const DETAILS = {
  icaoHex: 'A4CE45',
  registration: 'N409CC',
  make: 'PIPER AIRCRAFT INC',
  model: 'PA-28-181',
  operator: 'PAPPY AIR LLC',
  yearManufactured: 2023,
};

function respondWith(body: unknown, ok = true): typeof fetch {
  return vi.fn(() =>
    Promise.resolve({ ok, json: () => Promise.resolve(body) }),
  ) as unknown as typeof fetch;
}

describe('parseAircraftDetails', () => {
  it('accepts a full record, and one with only the fields every record has', () => {
    expect(parseAircraftDetails(DETAILS)).toEqual(DETAILS);
    expect(parseAircraftDetails({ icaoHex: 'A00001', registration: 'N1' })).toEqual({
      icaoHex: 'A00001',
      registration: 'N1',
    });
  });

  it('drops an optional field of the wrong type rather than the whole record', () => {
    expect(
      parseAircraftDetails({
        icaoHex: 'A00001',
        registration: 'N1',
        make: 7,
        model: null,
        operator: {},
        yearManufactured: '2023',
      }),
    ).toEqual({ icaoHex: 'A00001', registration: 'N1' });
  });

  it('rejects anything that is not a registry record', () => {
    expect(parseAircraftDetails(null)).toBeUndefined();
    expect(parseAircraftDetails('N409CC')).toBeUndefined();
    expect(parseAircraftDetails({ registration: 'N1' })).toBeUndefined();
    expect(parseAircraftDetails({ icaoHex: 'A00001' })).toBeUndefined();
    expect(parseAircraftDetails({ icaoHex: 7, registration: 'N1' })).toBeUndefined();
  });
});

describe('aircraftDetailsUrl', () => {
  it('names the aircraft in the path, encoded', () => {
    expect(aircraftDetailsUrl('a4ce45')).toBe('/api/aircraft/a4ce45');
    expect(aircraftDetailsUrl('a/b')).toBe('/api/aircraft/a%2Fb');
  });
});

describe('fetchAircraftDetails', () => {
  it('fetches and validates the details of the aircraft asked for', async () => {
    const fetchImpl = respondWith(DETAILS);

    await expect(fetchAircraftDetails('a4ce45', fetchImpl)).resolves.toEqual(DETAILS);
    expect(fetchImpl).toHaveBeenCalledWith('/api/aircraft/a4ce45');
  });

  it('finds nothing for an aircraft the registry does not know', async () => {
    await expect(fetchAircraftDetails('c0ffee', respondWith('Not found', false))).resolves.toBe(
      undefined,
    );
  });

  it('finds nothing in a body that is not a record, or when the request fails', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;

    await expect(fetchAircraftDetails('a4ce45', respondWith([]))).resolves.toBeUndefined();
    await expect(fetchAircraftDetails('a4ce45', failing)).resolves.toBeUndefined();
  });
});
