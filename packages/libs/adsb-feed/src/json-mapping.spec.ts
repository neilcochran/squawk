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

  it.each([
    ['none', 'none'],
    ['general', 'general'],
    ['lifeguard', 'lifeguardMedical'],
    ['minfuel', 'minimumFuel'],
    ['nordo', 'noCommunications'],
    ['unlawful', 'unlawfulInterference'],
    ['downed', 'downed'],
    ['reserved', 'reserved'],
  ] as const)('maps emergency %s to emergencyState %s', (raw, expected) => {
    expect(mapJsonAircraft({ hex: 'a0b1c2', emergency: raw })?.emergencyState).toBe(expected);
  });

  it('omits emergencyState when the emergency field is absent or unrecognized', () => {
    expect(mapJsonAircraft({ hex: 'a0b1c2' })?.emergencyState).toBeUndefined();
    expect(
      mapJsonAircraft({ hex: 'a0b1c2', emergency: 'not-a-real-value' })?.emergencyState,
    ).toBeUndefined();
  });
});

// Records below are verbatim entries from a live dump1090-fa aircraft.json
// response, not hand-authored, so field presence and precision reflect what
// the format actually produces rather than what a synthetic test assumes.
describe('mapJsonAircraft - real dump1090-fa capture', () => {
  it('maps a real full-featured airborne record', () => {
    const update = mapJsonAircraft({
      hex: '4075c1',
      flight: 'UBT70A  ',
      alt_baro: 37975,
      alt_geom: 39300,
      gs: 440.6,
      ias: 259,
      tas: 472,
      mach: 0.816,
      track: 205.1,
      track_rate: 0,
      roll: 0,
      mag_heading: 228.3,
      baro_rate: 32,
      geom_rate: 64,
      squawk: '1330',
      emergency: 'none',
      category: 'A5',
      nav_qnh: 1012.8,
      nav_altitude_mcp: 38016,
      nav_heading: 227.8,
      nav_modes: ['autopilot', 'vnav', 'lnav', 'tcas'],
      lat: 43.547989,
      lon: -70.535104,
      nic: 8,
      rc: 186,
      seen_pos: 0.2,
      version: 2,
      messages: 1325,
      seen: 0.2,
      rssi: -3.9,
    });

    expect(update).toEqual({
      icaoHex: '4075C1',
      callsign: 'UBT70A',
      lat: 43.547989,
      lon: -70.535104,
      onGround: false,
      baroAltitudeFt: 37975,
      geoAltitudeFt: 39300,
      groundSpeedKt: 440.6,
      indicatedAirspeedKt: 259,
      trueAirspeedKt: 472,
      trueTrackDeg: 205.1,
      magneticHeadingDeg: 228.3,
      verticalRateFtPerMin: 32,
      squawk: '1330',
      emergencyState: 'none',
      category: 'heavy',
    });
  });

  it('maps a real record with most optional fields absent', () => {
    const update = mapJsonAircraft({
      hex: 'ac6f7d',
      category: 'A1',
      version: 2,
      sil_type: 'perhour',
      mlat: [],
      tisb: [],
      messages: 970,
      seen: 129.4,
      rssi: -17.1,
    });

    expect(update).toEqual({
      icaoHex: 'AC6F7D',
      category: 'light',
    });
  });
});
