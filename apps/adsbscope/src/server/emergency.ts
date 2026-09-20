import { isDeclaredEmergencyState, isEmergencySquawk } from '@squawk/adsb-feed';
import type { Aircraft, EmergencyState } from '@squawk/types';

import type { ScopeEmergencyKind } from '../shared/protocol.js';

/** The emergency each of the three reserved squawk codes declares. */
const EMERGENCY_KIND_BY_SQUAWK: Readonly<Record<string, ScopeEmergencyKind>> = {
  '7500': 'unlawfulInterference',
  '7600': 'radioFailure',
  '7700': 'general',
};

/** The emergency each broadcast emergency/priority state declares. `none` and `reserved` declare none. */
const EMERGENCY_KIND_BY_STATE: Readonly<Partial<Record<EmergencyState, ScopeEmergencyKind>>> = {
  general: 'general',
  lifeguardMedical: 'medical',
  minimumFuel: 'minimumFuel',
  noCommunications: 'radioFailure',
  unlawfulInterference: 'unlawfulInterference',
  downed: 'downed',
};

/**
 * Decides what kind of emergency, if any, an aircraft is in. The three
 * signals `isEmergencyAircraft` of `@squawk/adsb-feed` accepts are read in
 * order of how deliberate they are: a squawk code the crew dialed in, then
 * the emergency state the transponder broadcasts, then an active ACAS/TCAS
 * Resolution Advisory, which the aircraft raises by itself and which passes
 * in seconds.
 *
 * @param aircraft - The aircraft's current normalized state.
 * @returns The kind of emergency, or undefined if the aircraft is not in one.
 */
export function classifyEmergency(aircraft: Aircraft): ScopeEmergencyKind | undefined {
  const { squawk, emergencyState } = aircraft;
  const bySquawk =
    squawk !== undefined && isEmergencySquawk(squawk)
      ? EMERGENCY_KIND_BY_SQUAWK[squawk]
      : undefined;
  const byState =
    emergencyState !== undefined && isDeclaredEmergencyState(emergencyState)
      ? EMERGENCY_KIND_BY_STATE[emergencyState]
      : undefined;
  const byAdvisory =
    aircraft.resolutionAdvisory?.active === true ? 'resolutionAdvisory' : undefined;
  return bySquawk ?? byState ?? byAdvisory;
}
