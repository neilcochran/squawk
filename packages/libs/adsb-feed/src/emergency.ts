import type { Aircraft, EmergencyState } from '@squawk/types';

/** Squawk codes that always indicate a declared emergency: 7500 (unlawful interference), 7600 (radio failure), and 7700 (general emergency). */
export const EMERGENCY_SQUAWKS: ReadonlySet<string> = new Set(['7500', '7600', '7700']);

/**
 * Whether `squawk` is one of the three universally-reserved emergency codes.
 * Works identically across all three feed sources, since `squawk` is
 * populated uniformly by JSON, SBS, and Beast.
 *
 * @param squawk - The aircraft's current squawk code, if known.
 * @returns True if `squawk` is 7500, 7600, or 7700.
 */
export function isEmergencySquawk(squawk: string | undefined): boolean {
  return squawk !== undefined && EMERGENCY_SQUAWKS.has(squawk);
}

/**
 * Whether `emergencyState` declares an emergency. `'none'` and `'reserved'`
 * do not; every other {@link EmergencyState} value does.
 *
 * @param emergencyState - The aircraft's broadcast emergency/priority state, if known.
 * @returns True if the state is a declared emergency.
 */
export function isDeclaredEmergencyState(emergencyState: EmergencyState | undefined): boolean {
  return emergencyState !== undefined && emergencyState !== 'none' && emergencyState !== 'reserved';
}

/**
 * Whether `aircraft` is in an emergency: an emergency squawk code, a declared
 * emergency state, or a currently-active ACAS/TCAS Resolution Advisory. Any
 * one of the three is sufficient - they arrive on different messages, and
 * from different sources (see the README's "Field population by source"
 * section), so they are not expected to always agree.
 *
 * @param aircraft - The aircraft to check.
 * @returns True if any of the three emergency signals is present.
 */
export function isEmergencyAircraft(aircraft: Aircraft): boolean {
  return (
    isEmergencySquawk(aircraft.squawk) ||
    isDeclaredEmergencyState(aircraft.emergencyState) ||
    aircraft.resolutionAdvisory?.active === true
  );
}
