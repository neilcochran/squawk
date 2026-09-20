import type { ScopeEmergencyKind } from '../../shared/protocol.js';

/**
 * The code shown for each kind of emergency. `EM`, `RF`, and `HJ` are what a
 * real scope adds to the data block of an aircraft squawking 7700, 7600, and
 * 7500; the rest follow their pattern.
 */
export const EMERGENCY_CODES: Readonly<Record<ScopeEmergencyKind, string>> = {
  general: 'EM',
  radioFailure: 'RF',
  unlawfulInterference: 'HJ',
  medical: 'MED',
  minimumFuel: 'FUEL',
  downed: 'DOWN',
  resolutionAdvisory: 'RA',
};

/** How long one flash of an emergency target lasts: on for the first half, off for the second. */
export const EMERGENCY_FLASH_PERIOD_MS = 1000;

/**
 * Decides whether emergency targets are in the lit half of their flash at an
 * instant. Every emergency target flashes in unison.
 *
 * @param frameTimeMs - The animation clock, in milliseconds.
 * @returns True during the lit half of each {@link EMERGENCY_FLASH_PERIOD_MS}.
 */
export function isEmergencyFlashOn(frameTimeMs: number): boolean {
  return frameTimeMs % EMERGENCY_FLASH_PERIOD_MS < EMERGENCY_FLASH_PERIOD_MS / 2;
}
