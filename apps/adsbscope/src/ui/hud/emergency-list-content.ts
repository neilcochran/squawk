import type { ScopeSnapshot } from '../../shared/protocol.js';
import { formatDataBlock } from '../scope/data-block.js';

/** One aircraft in the emergency list. */
export interface EmergencyListRow {
  /** The aircraft's ICAO hex: its identity between snapshots. */
  icaoHex: string;
  /** Its callsign (or ICAO hex) and emergency code, as on the first line of its data block. */
  identity: string;
  /** The squawk code it is sending, if it has sent one. */
  squawk: string | undefined;
}

/**
 * Builds the emergency list: every aircraft in an emergency, whether or not
 * it can be seen on the scope - one beyond the selected range, or with no
 * position at all, is listed just the same. Rows are ordered by identity so
 * they hold still from one snapshot to the next.
 *
 * @param snapshot - The most recent snapshot, or undefined before the first one arrives.
 * @returns The rows to show; empty when nothing is in an emergency.
 */
export function buildEmergencyList(snapshot: ScopeSnapshot | undefined): EmergencyListRow[] {
  return (snapshot?.targets ?? [])
    .filter((target) => target.emergency !== undefined)
    .map((target) => ({
      icaoHex: target.icaoHex,
      identity: formatDataBlock(target)[0],
      squawk: target.squawk,
    }))
    .sort((a, b) => a.identity.localeCompare(b.identity) || a.icaoHex.localeCompare(b.icaoHex));
}
