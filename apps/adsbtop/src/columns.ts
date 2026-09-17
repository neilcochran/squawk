import type { Aircraft, Coordinates } from '@squawk/types';

import { categoryOrdinal, formatCategoryCode } from './category.js';
import type { FeedSource } from './cli-args.js';
import { closestPointOfApproach } from './cpa.js';
import {
  formatAltitude,
  formatAge,
  formatBearing,
  formatClosestApproach,
  formatDistance,
  formatGroundSpeed,
  formatHeading,
  formatOnGround,
  formatVerticalRate,
} from './format.js';
import { bearingToAircraftDeg, distanceToAircraftNm } from './location.js';

/**
 * Identifies one table column. Doubles as the column's React list key and,
 * for every column except `onGround`, as its {@link SortKey}.
 */
export type ColumnKey =
  | 'icaoHex'
  | 'callsign'
  | 'registration'
  | 'category'
  | 'squawk'
  | 'altitude'
  | 'groundSpeed'
  | 'heading'
  | 'verticalRate'
  | 'onGround'
  | 'age'
  | 'distance'
  | 'bearing'
  | 'closestApproach';

/**
 * Table sort keys - every column except Grnd, whose two-valued content has
 * no useful ordering. `distance`, `bearing`, and `closestApproach` are only
 * reachable when a receiver location is configured, since their values need
 * one to compute.
 */
export type SortKey = Exclude<ColumnKey, 'onGround'>;

/** Which way the active sort column is ordered, toggled by the `[R]` hotkey. */
export type SortDirection = 'asc' | 'desc';

/** Per-render inputs a column's cell renderer may need beyond the aircraft itself. */
export interface RenderContext {
  /** The current time, for age-relative columns. */
  nowMs: number;
  /** The configured receiver location (`--lat`/`--lon`), if any. The location-gated columns render a placeholder without it. */
  location: Coordinates | undefined;
}

/** One column in the aircraft table. */
export interface ColumnDef {
  /** Stable identifier for the column, also used as its React list key. */
  key: ColumnKey;
  /** Column header text. Also the name `--columns` accepts for this column, matched case-insensitively. */
  header: string;
  /** Full, unabbreviated name shown alongside `header` in the column picker so the short headers are never ambiguous. */
  name: string;
  /** Fixed display width, in terminal columns. Headers and cells are padded/truncated to this. */
  width: number;
  /** Whether this column is in the minimal preset - the reduced set the column picker's `[M]` key selects for narrow terminals. */
  minimal: boolean;
  /** Whether the column needs a receiver location to compute at all. Such columns are unavailable (not merely hidden) without `--lat`/`--lon`. */
  requiresLocation: boolean;
  /** Feed sources that never carry this column's data, making it unavailable for the session - e.g. SBS/BaseStation has no aircraft category field. */
  unsupportedSources: readonly FeedSource[];
  /**
   * Renders one aircraft's value for this column.
   *
   * @param aircraft - The aircraft to render a cell for.
   * @param context - The current time and configured location.
   */
  render: (aircraft: Aircraft, context: RenderContext) => string;
}

/**
 * Every table column, in display order. Which of these actually render is
 * decided per session by {@link availableColumns} (drops the location-gated
 * columns without a location), then either {@link autoFitColumns} or
 * {@link selectColumns}.
 */
export const COLUMNS: readonly ColumnDef[] = [
  {
    key: 'icaoHex',
    header: 'ICAO',
    name: 'ICAO 24-bit address',
    width: 6,
    minimal: true,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft) => aircraft.icaoHex,
  },
  {
    key: 'callsign',
    header: 'Callsign',
    name: 'Callsign',
    width: 10,
    minimal: true,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft) => aircraft.callsign ?? '-',
  },
  {
    key: 'registration',
    header: 'Reg',
    name: 'Registration (N-number)',
    width: 7,
    minimal: false,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft) => aircraft.registration?.registration ?? '-',
  },
  {
    key: 'category',
    header: 'Cat',
    name: 'Aircraft category',
    width: 5,
    minimal: false,
    requiresLocation: false,
    unsupportedSources: ['sbs'],
    render: (aircraft) => formatCategoryCode(aircraft.category),
  },
  {
    key: 'squawk',
    header: 'Squawk',
    name: 'Squawk code',
    width: 8,
    minimal: true,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft) => aircraft.squawk ?? '-',
  },
  {
    key: 'altitude',
    header: 'Alt',
    name: 'Altitude',
    width: 7,
    minimal: true,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft) => formatAltitude(aircraft),
  },
  {
    key: 'groundSpeed',
    header: 'GS',
    name: 'Ground speed',
    width: 6,
    minimal: false,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft) => formatGroundSpeed(aircraft),
  },
  {
    key: 'heading',
    header: 'Hdg',
    name: 'Heading (true track)',
    width: 5,
    minimal: false,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft) => formatHeading(aircraft),
  },
  {
    key: 'verticalRate',
    header: 'VS',
    name: 'Vertical speed',
    width: 8,
    minimal: false,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft) => formatVerticalRate(aircraft),
  },
  {
    key: 'onGround',
    header: 'Grnd',
    name: 'On ground',
    width: 4,
    minimal: false,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft) => formatOnGround(aircraft),
  },
  {
    key: 'age',
    header: 'Age',
    name: 'Time since last update',
    width: 6,
    minimal: true,
    requiresLocation: false,
    unsupportedSources: [],
    render: (aircraft, context) => formatAge(aircraft.lastSeenAt, context.nowMs),
  },
  {
    key: 'distance',
    header: 'Dist',
    name: 'Distance from receiver',
    width: 6,
    minimal: false,
    requiresLocation: true,
    unsupportedSources: [],
    render: (aircraft, context) =>
      context.location === undefined
        ? '-'
        : formatDistance(distanceToAircraftNm(context.location, aircraft)),
  },
  {
    key: 'bearing',
    header: 'Brg',
    name: 'Bearing from receiver',
    width: 5,
    minimal: false,
    requiresLocation: true,
    unsupportedSources: [],
    render: (aircraft, context) =>
      context.location === undefined
        ? '-'
        : formatBearing(bearingToAircraftDeg(context.location, aircraft)),
  },
  {
    key: 'closestApproach',
    header: 'CPA',
    name: 'Closest point of approach',
    width: 14,
    minimal: false,
    requiresLocation: true,
    unsupportedSources: [],
    render: (aircraft, context) =>
      context.location === undefined
        ? '-'
        : formatClosestApproach(closestPointOfApproach(context.location, aircraft)),
  },
] as const;

/**
 * Width of the gap between adjacent columns: the header row renders it as
 * ` | ` and data rows as a matching right margin, so the two stay aligned.
 */
export const COLUMN_SEPARATOR_WIDTH = ' | '.length;

/**
 * Terminal columns the table consumes beyond its rows: the round border
 * (one each side) and `paddingX={1}` (one each side). Keep in sync with
 * `AircraftTable`'s outer `Box`.
 */
export const TABLE_CHROME_WIDTH = 4;

/**
 * Order columns are removed in when {@link autoFitColumns} has to shrink
 * the table for a narrow terminal, least valuable first. `icaoHex` is
 * deliberately absent - it is never dropped, since a row with no identity
 * is useless.
 */
const AUTO_FIT_DROP_ORDER: readonly ColumnKey[] = [
  'onGround',
  'category',
  'registration',
  'verticalRate',
  'bearing',
  'heading',
  'closestApproach',
  'groundSpeed',
  'distance',
  'age',
  'squawk',
  'altitude',
  'callsign',
];

/** What the session can supply to columns: which feed it reads and whether a receiver location is configured. */
export interface ColumnAvailability {
  /** The feed source in use - some columns' data is never carried by some sources. */
  source: FeedSource;
  /** The configured receiver location, if any - the location-gated columns need one. */
  location: Coordinates | undefined;
}

/** A column the session cannot populate, with the reason, for the column picker's dimmed rows. */
export interface UnavailableColumn {
  /** The column. */
  column: ColumnDef;
  /** Short reason it is unavailable, phrased as a predicate: `"needs --lat/--lon"` or `"is not sent by sbs"`. */
  reason: string;
}

/**
 * Why `column` cannot render this session, or undefined if it can. A column
 * is unavailable when it needs a receiver location and none is configured,
 * or when the feed source in use never carries its data.
 *
 * @param column - The column to check.
 * @param availability - What the session can supply.
 * @returns A short reason phrased as a predicate ("needs ...", "is not sent by ..."), for the picker and `--columns` errors, or undefined when available.
 */
export function unavailableReason(
  column: ColumnDef,
  availability: ColumnAvailability,
): string | undefined {
  if (column.requiresLocation && availability.location === undefined) {
    return 'needs --lat/--lon';
  }
  if (column.unsupportedSources.includes(availability.source)) {
    return `is not sent by ${availability.source}`;
  }
  return undefined;
}

/**
 * The columns that can render at all this session: every column, minus
 * those the session cannot populate (see {@link unavailableReason}). Those
 * are omitted entirely (not shown blank), and are not selectable in the
 * column picker or by `--columns`.
 *
 * @param availability - What the session can supply.
 * @returns The available columns, in display order.
 */
export function availableColumns(availability: ColumnAvailability): readonly ColumnDef[] {
  return COLUMNS.filter((column) => unavailableReason(column, availability) === undefined);
}

/**
 * The columns the session cannot populate, each with its reason, in display
 * order - the complement of {@link availableColumns}.
 *
 * @param availability - What the session can supply.
 * @returns The unavailable columns and why.
 */
export function unavailableColumns(availability: ColumnAvailability): readonly UnavailableColumn[] {
  const unavailable: UnavailableColumn[] = [];
  for (const column of COLUMNS) {
    const reason = unavailableReason(column, availability);
    if (reason !== undefined) {
      unavailable.push({ column, reason });
    }
  }
  return unavailable;
}

/**
 * Terminal columns a table row occupies: every column's width plus the
 * separators between them. Excludes {@link TABLE_CHROME_WIDTH}.
 *
 * @param columns - The columns in the row.
 * @returns The row width in terminal columns; zero for no columns.
 */
export function tableRowWidth(columns: readonly ColumnDef[]): number {
  if (columns.length === 0) {
    return 0;
  }
  const cellWidth = columns.reduce((total, column) => total + column.width, 0);
  return cellWidth + COLUMN_SEPARATOR_WIDTH * (columns.length - 1);
}

/**
 * Picks the subset of `available` that fits in `terminalWidth`, dropping
 * columns in {@link AUTO_FIT_DROP_ORDER} until the row (plus the table's
 * border and padding) fits. Stops at `icaoHex` regardless of width, since a
 * table with no identity column is worse than a truncated one.
 *
 * @param available - The columns that could render, in display order (see {@link availableColumns}).
 * @param terminalWidth - The terminal's current width in columns.
 * @returns The columns to render, in display order.
 */
export function autoFitColumns(
  available: readonly ColumnDef[],
  terminalWidth: number,
): readonly ColumnDef[] {
  let columns = available;
  for (const key of AUTO_FIT_DROP_ORDER) {
    if (tableRowWidth(columns) + TABLE_CHROME_WIDTH <= terminalWidth) {
      break;
    }
    columns = columns.filter((column) => column.key !== key);
  }
  return columns;
}

/**
 * The columns from `available` whose key is in `keys`, in display order.
 * The order of `keys` is not significant, and keys not in `available` (a
 * location-gated column without a location) are ignored.
 *
 * @param available - The columns that could render (see {@link availableColumns}).
 * @param keys - The keys to show.
 * @returns The matching columns, in display order.
 */
export function selectColumns(
  available: readonly ColumnDef[],
  keys: readonly ColumnKey[],
): readonly ColumnDef[] {
  return available.filter((column) => keys.includes(column.key));
}

/**
 * Keys of the minimal preset: the reduced column set for narrow terminals,
 * selected by the column picker's `[M]` key.
 *
 * @returns The minimal preset's column keys, in display order.
 */
export function minimalColumnKeys(): readonly ColumnKey[] {
  return COLUMNS.filter((column) => column.minimal).map((column) => column.key);
}

/**
 * Looks up a column by the name `--columns` accepts: its header text,
 * case-insensitively.
 *
 * @param name - The name to look up, e.g. `"cpa"` or `"Callsign"`.
 * @returns The matching column, or undefined if none has that header.
 */
export function findColumnByName(name: string): ColumnDef | undefined {
  const wanted = name.trim().toLowerCase();
  return COLUMNS.find((column) => column.header.toLowerCase() === wanted);
}

/** A `parseColumnList` failure. */
export interface ColumnListError {
  /** Human-readable message describing what was wrong with the list. */
  message: string;
}

/**
 * Parses a `--columns` value: comma-separated column header names, matched
 * case-insensitively. Unknown names and duplicates are errors rather than
 * silently ignored, so a typo never quietly hides a column. Does not check
 * availability - that is the CLI parser's job, since it knows the session's
 * source and location (see {@link unavailableReason}).
 *
 * @param value - The raw `--columns` value.
 * @returns The parsed keys in the order given, or a {@link ColumnListError}.
 */
export function parseColumnList(value: string): { keys: ColumnKey[] } | ColumnListError {
  const validNames = COLUMNS.map((column) => column.header).join(', ');
  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  if (names.length === 0) {
    return {
      message: `--columns needs at least one column name - expected any of: ${validNames}.`,
    };
  }
  const keys: ColumnKey[] = [];
  for (const name of names) {
    const column = findColumnByName(name);
    if (column === undefined) {
      return { message: `Unknown column "${name}" in --columns - expected any of: ${validNames}.` };
    }
    if (keys.includes(column.key)) {
      return { message: `Duplicate column "${name}" in --columns.` };
    }
    keys.push(column.key);
  }
  return { keys };
}

function isSortKey(key: ColumnKey): key is SortKey {
  return key !== 'onGround';
}

/**
 * The ordered list of sort keys `[O]` cycles through: every visible column
 * except Grnd, in display order. Follows the visible set so the cycle never
 * lands on a column the user cannot see.
 *
 * @param columns - The columns currently rendered, in display order.
 * @returns The sort keys in cycle order.
 */
export function sortKeyCycle(columns: readonly ColumnDef[]): readonly SortKey[] {
  return columns.map((column) => column.key).filter(isSortKey);
}

/**
 * Steps to the adjacent sort key in `cycle`, wrapping at either end. `[O]`
 * steps forward and `[Shift+O]` steps back. A `current` that is not in the
 * cycle (its column was just hidden) steps to the cycle's first key.
 *
 * @param current - The active sort key.
 * @param cycle - The sort keys to step through (see {@link sortKeyCycle}).
 * @param step - `1` to advance, `-1` to go back.
 * @returns The adjacent sort key in the cycle, or `current` if the cycle is empty.
 */
export function nextSortKey(current: SortKey, cycle: readonly SortKey[], step: 1 | -1): SortKey {
  const index = cycle.indexOf(current);
  if (index === -1) {
    return cycle[0] ?? current;
  }
  const nextIndex = (index + step + cycle.length) % cycle.length;
  return cycle[nextIndex] ?? current;
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
 * Closest approach orders by the distance at closest approach, so ascending
 * puts the aircraft that will pass nearest the receiver first. Category
 * orders by emitter-category table position, so the weight classes ascend
 * rather than sorting alphabetically by name.
 *
 * @param aircraft - The aircraft to read the sort value from.
 * @param sortKey - The field to read.
 * @param location - The configured receiver location, needed for `distance`/`bearing`/`closestApproach`.
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
    case 'category':
      return categoryOrdinal(aircraft.category);
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
    case 'closestApproach':
      return location === undefined
        ? undefined
        : closestPointOfApproach(location, aircraft)?.distanceNm;
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
 * @param location - The configured receiver location, if any - required for the `distance`/`bearing`/`closestApproach` keys to order at all.
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
 * @param location - The configured receiver location, if any - required for the `distance`/`bearing`/`closestApproach` keys.
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
