import { describe, it, expect } from 'vitest';

import {
  AIRCRAFT_TYPE_MAP,
  ENGINE_TYPE_MAP,
  PLACEHOLDER_REGISTRANT_NAMES,
  REGISTRATION_STATUS_MAP,
} from './code-maps.js';

describe('AIRCRAFT_TYPE_MAP', () => {
  it('maps all FAA aircraft type codes', () => {
    expect(AIRCRAFT_TYPE_MAP['1']).toBe('glider');
    expect(AIRCRAFT_TYPE_MAP['2']).toBe('balloon');
    expect(AIRCRAFT_TYPE_MAP['3']).toBe('blimpOrDirigible');
    expect(AIRCRAFT_TYPE_MAP['4']).toBe('fixedWingSingleEngine');
    expect(AIRCRAFT_TYPE_MAP['5']).toBe('fixedWingMultiEngine');
    expect(AIRCRAFT_TYPE_MAP['6']).toBe('rotorcraft');
    expect(AIRCRAFT_TYPE_MAP['7']).toBe('weightShiftControl');
    expect(AIRCRAFT_TYPE_MAP['8']).toBe('poweredParachute');
    expect(AIRCRAFT_TYPE_MAP['9']).toBe('gyroplane');
    expect(AIRCRAFT_TYPE_MAP['H']).toBe('hybridLift');
    expect(AIRCRAFT_TYPE_MAP['O']).toBe('other');
  });

  it('has exactly 11 entries', () => {
    expect(Object.keys(AIRCRAFT_TYPE_MAP).length).toBe(11);
  });

  it('returns undefined for unknown codes', () => {
    expect(AIRCRAFT_TYPE_MAP['99']).toBe(undefined);
    expect(AIRCRAFT_TYPE_MAP['']).toBe(undefined);
  });
});

describe('ENGINE_TYPE_MAP', () => {
  it('maps all FAA engine type codes', () => {
    expect(ENGINE_TYPE_MAP['0']).toBe('none');
    expect(ENGINE_TYPE_MAP['1']).toBe('reciprocating');
    expect(ENGINE_TYPE_MAP['2']).toBe('turboProp');
    expect(ENGINE_TYPE_MAP['3']).toBe('turboShaft');
    expect(ENGINE_TYPE_MAP['4']).toBe('turboJet');
    expect(ENGINE_TYPE_MAP['5']).toBe('turboFan');
    expect(ENGINE_TYPE_MAP['6']).toBe('ramjet');
    expect(ENGINE_TYPE_MAP['7']).toBe('twoCycle');
    expect(ENGINE_TYPE_MAP['8']).toBe('fourCycle');
    expect(ENGINE_TYPE_MAP['9']).toBe('unknown');
    expect(ENGINE_TYPE_MAP['10']).toBe('electric');
    expect(ENGINE_TYPE_MAP['11']).toBe('rotary');
  });

  it('has exactly 12 entries', () => {
    expect(Object.keys(ENGINE_TYPE_MAP).length).toBe(12);
  });

  it('returns undefined for unknown codes', () => {
    expect(ENGINE_TYPE_MAP['99']).toBe(undefined);
    expect(ENGINE_TYPE_MAP['']).toBe(undefined);
  });
});

describe('REGISTRATION_STATUS_MAP', () => {
  it('maps the valid registration codes', () => {
    expect(REGISTRATION_STATUS_MAP['V']).toBe('valid');
    expect(REGISTRATION_STATUS_MAP['M']).toBe('validManufacturerDealer');
    expect(REGISTRATION_STATUS_MAP['T']).toBe('validTrainee');
  });

  it('maps the pending, sale-reported, revoked and canceled codes', () => {
    expect(REGISTRATION_STATUS_MAP['R']).toBe('registrationPending');
    expect(REGISTRATION_STATUS_MAP['19']).toBe('registrationPendingPendingCancellation');
    expect(REGISTRATION_STATUS_MAP['20']).toBe('registrationPendingCanceled');
    expect(REGISTRATION_STATUS_MAP['7']).toBe('saleReported');
    expect(REGISTRATION_STATUS_MAP['17']).toBe('saleReportedPendingCancellation');
    expect(REGISTRATION_STATUS_MAP['18']).toBe('saleReportedCanceled');
    expect(REGISTRATION_STATUS_MAP['9']).toBe('revoked');
    expect(REGISTRATION_STATUS_MAP['E']).toBe('revokedByEnforcement');
    expect(REGISTRATION_STATUS_MAP['21']).toBe('revokedPendingCancellation');
    expect(REGISTRATION_STATUS_MAP['22']).toBe('revokedCanceled');
    expect(REGISTRATION_STATUS_MAP['6']).toBe('administrativelyCanceled');
    expect(REGISTRATION_STATUS_MAP['W']).toBe('ineffectiveOrInvalid');
  });

  it('maps both codes the FAA publishes for one status to the same value', () => {
    expect(REGISTRATION_STATUS_MAP['13']).toBe('expired');
    expect(REGISTRATION_STATUS_MAP['27']).toBe('expired');
    expect(REGISTRATION_STATUS_MAP['16']).toBe('expiredPendingCancellation');
    expect(REGISTRATION_STATUS_MAP['29']).toBe('expiredPendingCancellation');
    expect(REGISTRATION_STATUS_MAP['14']).toBe('renewalFirstNotice');
    expect(REGISTRATION_STATUS_MAP['25']).toBe('renewalFirstNotice');
    expect(REGISTRATION_STATUS_MAP['15']).toBe('renewalSecondNotice');
    expect(REGISTRATION_STATUS_MAP['26']).toBe('renewalSecondNotice');
    expect(REGISTRATION_STATUS_MAP['24']).toBe('renewalThirdNotice');
    expect(REGISTRATION_STATUS_MAP['28']).toBe('renewalThirdNotice');
  });

  it('covers the 12 letter codes and the numeric codes 1 through 29', () => {
    for (const letter of ['A', 'D', 'E', 'M', 'N', 'R', 'S', 'T', 'V', 'W', 'X', 'Z']) {
      expect(REGISTRATION_STATUS_MAP[letter], letter).not.toBe(undefined);
    }
    for (let code = 1; code <= 29; code++) {
      expect(REGISTRATION_STATUS_MAP[String(code)], String(code)).not.toBe(undefined);
    }
    expect(Object.keys(REGISTRATION_STATUS_MAP).length).toBe(41);
  });

  it('returns undefined for unknown codes', () => {
    expect(REGISTRATION_STATUS_MAP['30']).toBe(undefined);
    expect(REGISTRATION_STATUS_MAP['']).toBe(undefined);
  });
});

describe('PLACEHOLDER_REGISTRANT_NAMES', () => {
  it('holds the names the FAA publishes in place of a registrant', () => {
    expect(PLACEHOLDER_REGISTRANT_NAMES.has('REGISTRATION PENDING')).toBe(true);
    expect(PLACEHOLDER_REGISTRANT_NAMES.has('SALE REPORTED')).toBe(true);
    expect(PLACEHOLDER_REGISTRANT_NAMES.has('ACME AVIATION LLC')).toBe(false);
  });
});
