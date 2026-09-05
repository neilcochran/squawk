import type { Aircraft, Coordinates } from '@squawk/types';

import {
  formatAltitude,
  formatAge,
  formatBearing,
  formatDistance,
  formatGroundSpeed,
  formatHeading,
  formatOnGround,
  formatVerticalRate,
} from './format.js';
import { bearingToAircraftDeg, distanceToAircraftNm } from './location.js';

/** One column in the aircraft table. */
export interface ColumnDef {
  /** Stable identifier for the column, also used as its React list key. */
  key: string;
  /** Column header text. */
  header: string;
  /** Fixed display width, in terminal columns. Headers and cells are padded/truncated to this. */
  width: number;
  /** Whether this column stays visible in compact mode (narrow terminals), toggled by the `[C]olumns` hotkey. */
  compact: boolean;
  /**
   * Renders one aircraft's value for this column.
   *
   * @param aircraft - The aircraft to render a cell for.
   * @param nowMs - The current time, for age-relative columns.
   */
  render: (aircraft: Aircraft, nowMs: number) => string;
}

/**
 * The aircraft table's columns, in display order. `compact: true` columns
 * are the reduced set shown on a narrow terminal; the rest are additionally
 * shown in the full-width layout. See {@link visibleColumns}.
 */
export const COLUMNS: readonly ColumnDef[] = [
  {
    key: 'icaoHex',
    header: 'ICAO',
    width: 6,
    compact: true,
    render: (aircraft) => aircraft.icaoHex,
  },
  {
    key: 'callsign',
    header: 'Callsign',
    width: 8,
    compact: true,
    render: (aircraft) => aircraft.callsign ?? '-',
  },
  {
    key: 'registration',
    header: 'Reg',
    width: 7,
    compact: false,
    render: (aircraft) => aircraft.registration?.registration ?? '-',
  },
  {
    key: 'squawk',
    header: 'Squawk',
    width: 6,
    compact: true,
    render: (aircraft) => aircraft.squawk ?? '-',
  },
  {
    key: 'altitude',
    header: 'Alt',
    width: 7,
    compact: true,
    render: (aircraft) => formatAltitude(aircraft),
  },
  {
    key: 'groundSpeed',
    header: 'GS',
    width: 6,
    compact: false,
    render: (aircraft) => formatGroundSpeed(aircraft),
  },
  {
    key: 'heading',
    header: 'Hdg',
    width: 5,
    compact: false,
    render: (aircraft) => formatHeading(aircraft),
  },
  {
    key: 'verticalRate',
    header: 'VS',
    width: 8,
    compact: false,
    render: (aircraft) => formatVerticalRate(aircraft),
  },
  {
    key: 'onGround',
    header: 'Grnd',
    width: 4,
    compact: false,
    render: (aircraft) => formatOnGround(aircraft),
  },
  {
    key: 'age',
    header: 'Age',
    width: 6,
    compact: true,
    render: (aircraft, nowMs) => formatAge(aircraft.lastSeenAt, nowMs),
  },
] as const;

/**
 * Builds the Dist column shown when a receiver location (`--lat`/`--lon`) is
 * configured. Not part of {@link COLUMNS} since its render function needs to
 * close over `location`.
 *
 * @param location - The configured receiver location.
 * @returns The Dist column definition.
 */
export function buildDistanceColumn(location: Coordinates): ColumnDef {
  return {
    key: 'distance',
    header: 'Dist',
    width: 6,
    compact: false,
    render: (aircraft) => formatDistance(distanceToAircraftNm(location, aircraft)),
  };
}

/**
 * Builds the Brg column shown when a receiver location (`--lat`/`--lon`) is
 * configured. Not part of {@link COLUMNS} since its render function needs to
 * close over `location`.
 *
 * @param location - The configured receiver location.
 * @returns The Brg column definition.
 */
export function buildBearingColumn(location: Coordinates): ColumnDef {
  return {
    key: 'bearing',
    header: 'Brg',
    width: 5,
    compact: false,
    render: (aircraft) => formatBearing(bearingToAircraftDeg(location, aircraft)),
  };
}

/**
 * Selects the columns to render for the current width mode, appending the
 * Dist/Brg columns when `location` is configured. Dist/Brg are omitted
 * entirely (not shown blank) without a configured location, and never shown
 * in compact mode regardless.
 *
 * @param compact - True to show only the columns marked `compact: true` (narrow terminal).
 * @param location - The configured receiver location, if any.
 * @returns The columns to render, in display order.
 */
export function visibleColumns(compact: boolean, location?: Coordinates): readonly ColumnDef[] {
  const baseColumns = compact ? COLUMNS.filter((column) => column.compact) : COLUMNS;
  if (compact || location === undefined) {
    return baseColumns;
  }
  return [...baseColumns, buildDistanceColumn(location), buildBearingColumn(location)];
}

/** Table sort keys, in the order `[O]` cycles through them. */
export type SortKey = 'icaoHex' | 'callsign' | 'altitude' | 'groundSpeed' | 'age';

/** The sort key `[O]` switches to next, from the current one. */
const NEXT_SORT_KEY: Record<SortKey, SortKey> = {
  icaoHex: 'callsign',
  callsign: 'altitude',
  altitude: 'groundSpeed',
  groundSpeed: 'age',
  age: 'icaoHex',
};

/**
 * Advances to the next sort key in the fixed cycle bound to the `[O]` hotkey.
 *
 * @param current - The active sort key.
 * @returns The next sort key in the cycle.
 */
export function nextSortKey(current: SortKey): SortKey {
  return NEXT_SORT_KEY[current];
}

/** Altitude used for sorting: barometric preferred, geometric fallback - mirrors {@link formatAltitude}'s precedence. */
function sortAltitudeFt(aircraft: Aircraft): number | undefined {
  return aircraft.position?.baroAltitudeFt ?? aircraft.position?.geoAltitudeFt;
}

/**
 * Compares two aircraft for ordering by `sortKey`. Aircraft missing the
 * sorted-on field always sort after aircraft that have it, regardless of
 * which key is active, so unknown values consistently sink to the bottom
 * instead of interleaving with real data.
 *
 * @param a - First aircraft to compare.
 * @param b - Second aircraft to compare.
 * @param sortKey - The field to compare on.
 * @returns A negative number if `a` sorts first, positive if `b` sorts first, zero if equivalent.
 */
export function compareAircraft(a: Aircraft, b: Aircraft, sortKey: SortKey): number {
  switch (sortKey) {
    case 'icaoHex':
      return a.icaoHex.localeCompare(b.icaoHex);
    case 'callsign': {
      if (a.callsign === undefined || b.callsign === undefined) {
        return (a.callsign === undefined ? 1 : 0) - (b.callsign === undefined ? 1 : 0);
      }
      return a.callsign.localeCompare(b.callsign);
    }
    case 'altitude': {
      const altitudeA = sortAltitudeFt(a);
      const altitudeB = sortAltitudeFt(b);
      if (altitudeA === undefined || altitudeB === undefined) {
        return (altitudeA === undefined ? 1 : 0) - (altitudeB === undefined ? 1 : 0);
      }
      return altitudeA - altitudeB;
    }
    case 'groundSpeed': {
      if (a.groundSpeedKt === undefined || b.groundSpeedKt === undefined) {
        return (a.groundSpeedKt === undefined ? 1 : 0) - (b.groundSpeedKt === undefined ? 1 : 0);
      }
      return a.groundSpeedKt - b.groundSpeedKt;
    }
    case 'age':
      // Most-recently-seen (smallest age) first - equivalent to descending lastSeenAt.
      return b.lastSeenAt - a.lastSeenAt;
    default:
      return 0;
  }
}

/**
 * Returns a new array of `aircraft` sorted by `sortKey`. Does not mutate the input.
 *
 * @param aircraft - The aircraft to sort.
 * @param sortKey - The field to sort on.
 * @returns A new, sorted array.
 */
export function sortAircraft(aircraft: readonly Aircraft[], sortKey: SortKey): Aircraft[] {
  return [...aircraft].sort((a, b) => compareAircraft(a, b, sortKey));
}
