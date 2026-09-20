import { describe, expect, it } from 'vitest';

import type { AcasResolutionAdvisoryReport, Aircraft, EmergencyState } from '@squawk/types';

import {
  EMERGENCY_SQUAWKS,
  isDeclaredEmergencyState,
  isEmergencyAircraft,
  isEmergencySquawk,
} from './emergency.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

function makeResolutionAdvisory(
  overrides: Partial<AcasResolutionAdvisoryReport> = {},
): AcasResolutionAdvisoryReport {
  return {
    active: true,
    advisoryType: 'climb',
    corrective: true,
    downwardSense: false,
    increasedRate: false,
    senseReversal: false,
    altitudeCrossing: false,
    positive: true,
    doNotPassBelow: false,
    doNotPassAbove: false,
    doNotTurnLeft: false,
    doNotTurnRight: false,
    terminated: false,
    multipleThreat: false,
    threat: { threatType: 'none' },
    ...overrides,
  };
}

describe('isEmergencySquawk', () => {
  it.each(['7500', '7600', '7700'])('treats %s as an emergency squawk', (squawk) => {
    expect(EMERGENCY_SQUAWKS.has(squawk)).toBe(true);
    expect(isEmergencySquawk(squawk)).toBe(true);
  });

  it('does not treat a routine squawk as an emergency', () => {
    expect(isEmergencySquawk('1200')).toBe(false);
  });

  it('returns false when squawk is undefined', () => {
    expect(isEmergencySquawk(undefined)).toBe(false);
  });
});

describe('isDeclaredEmergencyState', () => {
  const declared: EmergencyState[] = [
    'general',
    'lifeguardMedical',
    'minimumFuel',
    'noCommunications',
    'unlawfulInterference',
    'downed',
  ];

  it.each(declared)('treats %s as a declared emergency', (emergencyState) => {
    expect(isDeclaredEmergencyState(emergencyState)).toBe(true);
  });

  it('does not treat "none", "reserved", or an unknown state as a declared emergency', () => {
    expect(isDeclaredEmergencyState('none')).toBe(false);
    expect(isDeclaredEmergencyState('reserved')).toBe(false);
    expect(isDeclaredEmergencyState(undefined)).toBe(false);
  });
});

describe('isEmergencyAircraft', () => {
  it('treats an emergency squawk as an emergency', () => {
    expect(isEmergencyAircraft(makeAircraft({ squawk: '7700' }))).toBe(true);
  });

  it('treats a declared emergency state as an emergency', () => {
    expect(isEmergencyAircraft(makeAircraft({ emergencyState: 'minimumFuel' }))).toBe(true);
  });

  it('does not treat "none" or "reserved" emergency states as an emergency', () => {
    expect(isEmergencyAircraft(makeAircraft({ emergencyState: 'none' }))).toBe(false);
    expect(isEmergencyAircraft(makeAircraft({ emergencyState: 'reserved' }))).toBe(false);
  });

  it('treats an active resolution advisory as an emergency', () => {
    const aircraft = makeAircraft({
      resolutionAdvisory: makeResolutionAdvisory({ active: true }),
    });
    expect(isEmergencyAircraft(aircraft)).toBe(true);
  });

  it('does not treat an inactive resolution advisory as an emergency', () => {
    const aircraft = makeAircraft({
      resolutionAdvisory: makeResolutionAdvisory({ active: false }),
    });
    expect(isEmergencyAircraft(aircraft)).toBe(false);
  });

  it('returns false when none of the emergency signals are present', () => {
    expect(isEmergencyAircraft(makeAircraft())).toBe(false);
  });
});
