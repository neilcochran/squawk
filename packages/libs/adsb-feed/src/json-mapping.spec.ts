import { describe, it, expect } from 'vitest';

import { extractAircraftRecords, mapJsonAircraft } from './json-mapping.js';

describe('extractAircraftRecords', () => {
  it('returns the aircraft array from a well-shaped response', () => {
    const parsed = { now: 1700000000, messages: 42, aircraft: [{ hex: 'a0b1c2' }] };
    expect(extractAircraftRecords(parsed)).toEqual([{ hex: 'a0b1c2' }]);
  });

  it('returns an empty array when aircraft is missing', () => {
    expect(extractAircraftRecords({ now: 1700000000 })).toEqual([]);
  });

  it('returns an empty array when aircraft is not an array', () => {
    expect(extractAircraftRecords({ aircraft: 'nope' })).toEqual([]);
  });

  it('returns an empty array for non-object input', () => {
    expect(extractAircraftRecords(null)).toEqual([]);
    expect(extractAircraftRecords('not json')).toEqual([]);
    expect(extractAircraftRecords(undefined)).toEqual([]);
  });
});

describe('mapJsonAircraft', () => {
  it('maps a realistic full record', () => {
    const update = mapJsonAircraft({
      hex: 'a0b1c2',
      flight: 'UAL123  ',
      lat: 40.6413,
      lon: -73.7781,
      alt_baro: 5500,
      alt_geom: 5620,
      gs: 210.3,
      ias: 200,
      tas: 215,
      track: 271.4,
      mag_heading: 268.9,
      baro_rate: -640,
      squawk: '1200',
      category: 'A3',
    });

    expect(update).toEqual({
      icaoHex: 'A0B1C2',
      callsign: 'UAL123',
      lat: 40.6413,
      lon: -73.7781,
      onGround: false,
      baroAltitudeFt: 5500,
      geoAltitudeFt: 5620,
      groundSpeedKt: 210.3,
      indicatedAirspeedKt: 200,
      trueAirspeedKt: 215,
      trueTrackDeg: 271.4,
      magneticHeadingDeg: 268.9,
      verticalRateFtPerMin: -640,
      squawk: '1200',
      category: 'large',
    });
  });

  it('returns undefined for a record with no usable hex', () => {
    expect(mapJsonAircraft({ flight: 'UAL123' })).toBeUndefined();
    expect(mapJsonAircraft({ hex: '' })).toBeUndefined();
    expect(mapJsonAircraft('not an object')).toBeUndefined();
  });

  it('preserves a non-ICAO ~-prefixed hex, uppercased', () => {
    expect(mapJsonAircraft({ hex: '~a1b2c3' })?.icaoHex).toBe('~A1B2C3');
  });

  it('maps alt_baro "ground" to onGround without a barometric altitude', () => {
    const update = mapJsonAircraft({ hex: 'a0b1c2', alt_baro: 'ground' });
    expect(update?.onGround).toBe(true);
    expect(update?.baroAltitudeFt).toBeUndefined();
  });

  it('omits callsign when flight is blank or absent', () => {
    expect(mapJsonAircraft({ hex: 'a0b1c2', flight: '        ' })?.callsign).toBeUndefined();
    expect(mapJsonAircraft({ hex: 'a0b1c2' })?.callsign).toBeUndefined();
  });

  it('only sets lat/lon when both are present as numbers', () => {
    expect(mapJsonAircraft({ hex: 'a0b1c2', lat: 40.6 })?.lat).toBeUndefined();
    expect(mapJsonAircraft({ hex: 'a0b1c2', lon: -73.7 })?.lon).toBeUndefined();
  });

  it('falls back to geom_rate when baro_rate is absent', () => {
    expect(mapJsonAircraft({ hex: 'a0b1c2', geom_rate: 320 })?.verticalRateFtPerMin).toBe(320);
  });

  it('prefers baro_rate over geom_rate when both are present', () => {
    const update = mapJsonAircraft({ hex: 'a0b1c2', baro_rate: -100, geom_rate: -50 });
    expect(update?.verticalRateFtPerMin).toBe(-100);
  });

  it('omits category for an unrecognized code', () => {
    expect(mapJsonAircraft({ hex: 'a0b1c2', category: 'Z9' })?.category).toBeUndefined();
  });
});
