import { describe, expect, it } from 'vitest';

import { EMERGENCY_SQUAWKS, isEmergencyAircraft } from '@squawk/adsb-feed';
import type { AcasResolutionAdvisoryReport, Aircraft, EmergencyState } from '@squawk/types';

import type { ScopeEmergencyKind } from '../shared/protocol.js';

import { classifyEmergency } from './emergency.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'a1b2c3', lastSeenAt: 0, ...overrides };
}

function makeResolutionAdvisory(active: boolean): AcasResolutionAdvisoryReport {
  return {
    active,
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
  };
}

describe('classifyEmergency', () => {
  it('finds no emergency in a routine aircraft', () => {
    expect(classifyEmergency(makeAircraft())).toBeUndefined();
    expect(classifyEmergency(makeAircraft({ squawk: '1200', emergencyState: 'none' }))).toBe(
      undefined,
    );
  });

  it.each<[string, ScopeEmergencyKind]>([
    ['7500', 'unlawfulInterference'],
    ['7600', 'radioFailure'],
    ['7700', 'general'],
  ])('reads squawk %s as %s', (squawk, kind) => {
    expect(classifyEmergency(makeAircraft({ squawk }))).toBe(kind);
  });

  it('names a kind for every squawk the feed treats as an emergency', () => {
    for (const squawk of EMERGENCY_SQUAWKS) {
      expect(classifyEmergency(makeAircraft({ squawk }))).toBeDefined();
    }
  });

  it.each<[EmergencyState, ScopeEmergencyKind]>([
    ['general', 'general'],
    ['lifeguardMedical', 'medical'],
    ['minimumFuel', 'minimumFuel'],
    ['noCommunications', 'radioFailure'],
    ['unlawfulInterference', 'unlawfulInterference'],
    ['downed', 'downed'],
  ])('reads the declared state %s as %s', (emergencyState, kind) => {
    expect(classifyEmergency(makeAircraft({ emergencyState }))).toBe(kind);
  });

  it('does not read the reserved state as an emergency', () => {
    expect(classifyEmergency(makeAircraft({ emergencyState: 'reserved' }))).toBeUndefined();
  });

  it('reads an active Resolution Advisory as one, and an inactive one as nothing', () => {
    expect(
      classifyEmergency(makeAircraft({ resolutionAdvisory: makeResolutionAdvisory(true) })),
    ).toBe('resolutionAdvisory');
    expect(
      classifyEmergency(makeAircraft({ resolutionAdvisory: makeResolutionAdvisory(false) })),
    ).toBeUndefined();
  });

  it('prefers the squawk to the declared state, and the declared state to an advisory', () => {
    const resolutionAdvisory = makeResolutionAdvisory(true);

    expect(
      classifyEmergency(
        makeAircraft({ squawk: '7600', emergencyState: 'minimumFuel', resolutionAdvisory }),
      ),
    ).toBe('radioFailure');
    expect(
      classifyEmergency(
        makeAircraft({ squawk: '1200', emergencyState: 'minimumFuel', resolutionAdvisory }),
      ),
    ).toBe('minimumFuel');
  });

  it('agrees with the feed about which aircraft are in an emergency at all', () => {
    const samples: Aircraft[] = [
      makeAircraft(),
      makeAircraft({ squawk: '7700' }),
      makeAircraft({ squawk: '1200' }),
      makeAircraft({ emergencyState: 'downed' }),
      makeAircraft({ emergencyState: 'none' }),
      makeAircraft({ emergencyState: 'reserved' }),
      makeAircraft({ resolutionAdvisory: makeResolutionAdvisory(true) }),
      makeAircraft({ resolutionAdvisory: makeResolutionAdvisory(false) }),
    ];

    for (const aircraft of samples) {
      expect(classifyEmergency(aircraft) !== undefined).toBe(isEmergencyAircraft(aircraft));
    }
  });
});
