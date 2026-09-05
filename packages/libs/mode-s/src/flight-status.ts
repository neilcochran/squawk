import type { FlightStatus } from './types/index.js';

/**
 * Alert and Ident (SPI) status per Flight Status (FS) field value, 0-7, per
 * ICAO Annex 10 Vol. IV / RTCA DO-260 - cross-checked against dump1090-fa's
 * own `mode_s.c` FS decode (the reference decoder this package already
 * treats as ground truth for wire-format behavior; see the package README).
 * FS 6 and 7 are reserved: neither alert nor Ident status is defined for
 * them, so both fields are left undefined rather than guessed at false.
 */
const FLIGHT_STATUSES: readonly FlightStatus[] = [
  { identActive: false, squawkAlert: false }, // 0: no alert, no ident
  { identActive: false, squawkAlert: false }, // 1: no alert, no ident
  { identActive: false, squawkAlert: true }, // 2: alert, no ident
  { identActive: false, squawkAlert: true }, // 3: alert, no ident
  { identActive: true, squawkAlert: true }, // 4: alert, ident
  { identActive: true, squawkAlert: false }, // 5: no alert, ident
];

/** Returned for the reserved FS values (6, 7), where alert/Ident status is not defined. */
const RESERVED_FLIGHT_STATUS: FlightStatus = { identActive: undefined, squawkAlert: undefined };

/**
 * Decodes the 3-bit Flight Status (FS) field of a DF4/5/20/21 Mode-S
 * surveillance reply.
 *
 * @param fsField - The raw 3-bit field, 0-7.
 * @returns The decoded Alert and Ident status.
 */
export function decodeFlightStatus(fsField: number): FlightStatus {
  return FLIGHT_STATUSES[fsField] ?? RESERVED_FLIGHT_STATUS;
}
