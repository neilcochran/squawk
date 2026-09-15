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
    width: 10,
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
    width: 8,
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

/**
 * Table sort keys - every column except Grnd, whose two-valued content has
 * no useful ordering. `distance` and `bearing` are only reachable when a
 * receiver location is configured, since their values need one to compute.
 */
export type SortKey =
  | 'icaoHex'
  | 'callsign'
  | 'registration'
  | 'squawk'
  | 'altitude'
  | 'groundSpeed'
  | 'heading'
  | 'verticalRate'
  | 'age'
  | 'distance'
  | 'bearing';

/** Which way the active sort column is ordered, toggled by the `[R]` hotkey. */
export type SortDirection = 'asc' | 'desc';

/** Sort keys available regardless of configuration, in the table's column order. */
const BASE_SORT_KEYS: readonly SortKey[] = [
  'icaoHex',
  'callsign',
  'registration',
  'squawk',
  'altitude',
  'groundSpeed',
  'heading',
  'verticalRate',
  'age',
];

/** Sort keys that additionally become available once a receiver location is configured, matching the Dist/Brg columns. */
const LOCATION_SORT_KEYS: readonly SortKey[] = ['distance', 'bearing'];

/**
 * The ordered list of sort keys `[O]` cycles through: every base column in
 * display order, plus Dist/Brg at the end when `location` is configured.
 *
 * @param location - The configured receiver location, if any.
 * @returns The sort keys in cycle order.
 */
export function sortKeyCycle(location: Coordinates | undefined): readonly SortKey[] {
  return location === undefined ? BASE_SORT_KEYS : [...BASE_SORT_KEYS, ...LOCATION_SORT_KEYS];
}

/**
 * Steps to the adjacent sort key in the cycle bound to the `[O]` hotkey,
 * wrapping at either end. `[O]` steps forward and `[Shift+O]` steps back.
 *
 * @param current - The active sort key.
 * @param location - The configured receiver location, if any - controls whether Dist/Brg are part of the cycle.
 * @param step - `1` to advance, `-1` to go back.
 * @returns The adjacent sort key in the cycle.
 */
export function nextSortKey(
  current: SortKey,
  location: Coordinates | undefined,
  step: 1 | -1,
): SortKey {
  const cycle = sortKeyCycle(location);
  const index = cycle.indexOf(current);
  const nextIndex = (index + step + cycle.length) % cycle.length;
  return cycle[nextIndex] ?? cycle[0] ?? current;
}

/** Altitude used for sorting: barometric preferred, geometric fallback - mirrors {@link formatAltitude}'s precedence. */
function sortAltitudeFt(aircraft: Aircraft): number | undefined {
  return aircraft.position?.baroAltitudeFt ?? aircraft.position?.geoAltitudeFt;
}

/**
 * The value an aircraft is ordered by under `sortKey`, or undefined when the
 * aircraft has no value for that field. Each key mirrors what its column
 * renders (heading prefers true track over magnetic heading, altitude
 * prefers barometric over geometric, and so on) so the sort order matches
 * what is on screen. Age returns the negated last-seen timestamp so that
 * ascending order puts the most recently seen aircraft (smallest age) first.
 *
 * @param aircraft - The aircraft to read the sort value from.
 * @param sortKey - The field to read.
 * @param location - The configured receiver location, needed for `distance`/`bearing`.
 * @returns The sortable value, or undefined if the aircraft has none.
 */
function sortValue(
  aircraft: Aircraft,
  sortKey: SortKey,
  location: Coordinates | undefined,
): string | number | undefined {
  switch (sortKey) {
    case 'icaoHex':
      return aircraft.icaoHex;
    case 'callsign':
      return aircraft.callsign;
    case 'registration':
      return aircraft.registration?.registration;
    case 'squawk':
      return aircraft.squawk;
    case 'altitude':
      return sortAltitudeFt(aircraft);
    case 'groundSpeed':
      return aircraft.groundSpeedKt;
    case 'heading':
      return aircraft.trueTrackDeg ?? aircraft.magneticHeadingDeg;
    case 'verticalRate':
      return aircraft.verticalRateFtPerMin;
    case 'age':
      return -aircraft.lastSeenAt;
    case 'distance':
      return location === undefined ? undefined : distanceToAircraftNm(location, aircraft);
    case 'bearing':
      return location === undefined ? undefined : bearingToAircraftDeg(location, aircraft);
    default:
      return undefined;
  }
}

/**
 * Compares two aircraft for ordering by `sortKey` in `direction`. Aircraft
 * missing the sorted-on field always sort after aircraft that have it,
 * regardless of key or direction, so unknown values consistently sink to
 * the bottom instead of interleaving with real data or jumping to the top
 * when the order is reversed.
 *
 * @param a - First aircraft to compare.
 * @param b - Second aircraft to compare.
 * @param sortKey - The field to compare on.
 * @param direction - Ascending or descending order for aircraft that both have the field.
 * @param location - The configured receiver location, if any - required for the `distance`/`bearing` keys to order at all.
 * @returns A negative number if `a` sorts first, positive if `b` sorts first, zero if equivalent.
 */
export function compareAircraft(
  a: Aircraft,
  b: Aircraft,
  sortKey: SortKey,
  direction: SortDirection,
  location: Coordinates | undefined,
): number {
  const valueA = sortValue(a, sortKey, location);
  const valueB = sortValue(b, sortKey, location);
  if (valueA === undefined || valueB === undefined) {
    return (valueA === undefined ? 1 : 0) - (valueB === undefined ? 1 : 0);
  }
  let ordered: number;
  if (typeof valueA === 'string' && typeof valueB === 'string') {
    ordered = valueA.localeCompare(valueB);
  } else if (typeof valueA === 'number' && typeof valueB === 'number') {
    ordered = valueA - valueB;
  } else {
    ordered = 0;
  }
  return direction === 'asc' ? ordered : -ordered;
}

/**
 * Returns a new array of `aircraft` sorted by `sortKey` in `direction`. Does not mutate the input.
 *
 * @param aircraft - The aircraft to sort.
 * @param sortKey - The field to sort on.
 * @param direction - Ascending or descending order.
 * @param location - The configured receiver location, if any - required for the `distance`/`bearing` keys.
 * @returns A new, sorted array.
 */
export function sortAircraft(
  aircraft: readonly Aircraft[],
  sortKey: SortKey,
  direction: SortDirection,
  location: Coordinates | undefined,
): Aircraft[] {
  return [...aircraft].sort((a, b) => compareAircraft(a, b, sortKey, direction, location));
}
