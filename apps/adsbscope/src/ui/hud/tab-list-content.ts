import type { ScopeSnapshot } from '../../shared/protocol.js';
import { formatDataBlock } from '../scope/data-block.js';

/** The most aircraft the tab list names before it summarizes the rest as a count. */
export const TAB_LIST_MAX_ROWS = 8;

/** One aircraft in the tab list. */
export interface TabListRow {
  /** The aircraft's ICAO hex: its identity between snapshots. */
  icaoHex: string;
  /** Its callsign, or its ICAO hex until it has sent one. */
  identity: string;
  /** Its altitude and ground speed, as on the second line of a data block. */
  detail: string;
}

/** What the tab list shows. */
export interface TabListContent {
  /** The aircraft named, in order of identity. */
  rows: TabListRow[];
  /** How many more aircraft have no position than are named. */
  hiddenCount: number;
}

/**
 * Builds the tab list: the aircraft being heard from that have not sent a
 * position, and so cannot be plotted. Rows are ordered by identity, not by
 * arrival, so they hold still from one snapshot to the next.
 *
 * @param snapshot - The most recent snapshot, or undefined before the first one arrives.
 * @param maxRows - The most aircraft to name. Defaults to {@link TAB_LIST_MAX_ROWS}.
 * @returns The rows to show, and how many aircraft were left out.
 */
export function buildTabList(
  snapshot: ScopeSnapshot | undefined,
  maxRows: number = TAB_LIST_MAX_ROWS,
): TabListContent {
  const unplotted = (snapshot?.targets ?? []).filter((target) => target.position === undefined);
  const rows = unplotted
    .map((target) => {
      const [identity, detail] = formatDataBlock(target);
      return { icaoHex: target.icaoHex, identity, detail };
    })
    .sort((a, b) => a.identity.localeCompare(b.identity) || a.icaoHex.localeCompare(b.icaoHex));
  return { rows: rows.slice(0, maxRows), hiddenCount: Math.max(0, rows.length - maxRows) };
}
