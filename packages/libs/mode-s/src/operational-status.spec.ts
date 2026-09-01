import { describe, it, expect } from 'vitest';

import { decodeAircraftOperationalStatus } from './operational-status.js';
import { setBits } from './test-utils.js';

describe('decodeAircraftOperationalStatus', () => {
  it('decodes a fully-populated airborne, version-2 message', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 31); // type code
    setBits(me, 5, 3, 0); // subtype: airborne
    setBits(me, 8, 16, 0x1234); // capability class code (raw)
    setBits(me, 24, 16, 0x5678); // operational mode code (raw)
    setBits(me, 40, 3, 2); // ADS-B version 2
    setBits(me, 43, 1, 1); // NIC supplement A
    setBits(me, 44, 4, 7); // NAC_p
    setBits(me, 50, 2, 3); // SIL
    setBits(me, 52, 1, 1); // NIC_baro (airborne, version >= 1, so populated)
    setBits(me, 53, 1, 1); // heading reference: magnetic
    setBits(me, 54, 1, 1); // SIL supplement (version 2, so populated)

    expect(decodeAircraftOperationalStatus(me)).toEqual({
      surface: false,
      adsbVersion: 2,
      capabilityClassCode: 0x1234,
      operationalModeCode: 0x5678,
      nicSupplementA: true,
      navAccuracyCategoryPosition: 7,
      sourceIntegrityLevel: 3,
      nicBaro: true,
      headingReference: 'magnetic',
      silSupplementPerHour: true,
    });
  });

  it('reports surface true for subtype 1 and omits nicBaro regardless of version', () => {
    const me = new Uint8Array(7);
    setBits(me, 5, 3, 1); // subtype: surface
    setBits(me, 40, 3, 2); // version 2
    setBits(me, 52, 1, 1); // set anyway - must be ignored for a surface report

    const result = decodeAircraftOperationalStatus(me);
    expect(result.surface).toBe(true);
    expect(result.nicBaro).toBeUndefined();
  });

  it('reports surface false for any subtype value other than 1', () => {
    const me = new Uint8Array(7);
    setBits(me, 5, 3, 5); // reserved subtype value
    expect(decodeAircraftOperationalStatus(me).surface).toBe(false);
  });

  it('omits nicBaro for an airborne report on ADS-B version 0', () => {
    const me = new Uint8Array(7);
    setBits(me, 5, 3, 0); // airborne
    setBits(me, 40, 3, 0); // version 0
    setBits(me, 52, 1, 1); // set anyway - must be ignored, bit has no defined meaning on v0

    expect(decodeAircraftOperationalStatus(me).nicBaro).toBeUndefined();
  });

  it('omits silSupplementPerHour outside ADS-B version 2', () => {
    const me = new Uint8Array(7);
    setBits(me, 40, 3, 1); // version 1
    setBits(me, 54, 1, 1); // set anyway - must be ignored

    expect(decodeAircraftOperationalStatus(me).silSupplementPerHour).toBeUndefined();
  });

  it('reports headingReference true when the heading reference bit is unset', () => {
    const me = new Uint8Array(7);
    setBits(me, 53, 1, 0);
    expect(decodeAircraftOperationalStatus(me).headingReference).toBe('true');
  });
});
