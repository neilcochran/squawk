import { Box, Text } from 'ink';
import { Fragment } from 'react';
import type { ReactElement } from 'react';

import type { Aircraft, Coordinates } from '@squawk/types';

import { COLUMN_SEPARATOR_WIDTH } from '../columns.js';
import type { ColumnDef, RenderContext, SortDirection, SortKey } from '../columns.js';
import { isEmergencyAircraft } from '../format.js';
import { isFreshRow, isStaleRow, rowTextStyle } from '../row-style.js';
import type { RowTextStyle } from '../row-style.js';
import type { UnitSystem } from '../units.js';
import { isWindowed, windowLabel } from '../viewport.js';
import type { RowWindow } from '../viewport.js';
import { matchesWatchlist } from '../watchlist.js';

/** Props for {@link AircraftTable}. */
export interface AircraftTableProps {
  /** Aircraft to render, already sorted in display order. */
  aircraft: readonly Aircraft[];
  /** Columns to render, in display order. */
  columns: readonly ColumnDef[];
  /** Current time, passed through to age-relative column renderers. */
  nowMs: number;
  /** Configured receiver location, passed through to the location-gated column renderers. */
  location: Coordinates | undefined;
  /** Normalized `--watch` terms; rows matching any of them render highlighted. Empty for no watchlist. */
  watchlist: readonly string[];
  /** Unix epoch ms each aircraft was first tracked, keyed by ICAO hex - rows first seen within `NEW_HIGHLIGHT_MS` of `nowMs` render in the new-row style. */
  firstSeenAtByHex: ReadonlyMap<string, number>;
  /** The feed's stale threshold in ms - rows with no update for `STALE_DIM_FRACTION` of it render dimmed. */
  staleAfterMs: number;
  /** The unit system the unit-bearing columns render in. */
  units: UnitSystem;
  /** Which rows of `aircraft` to render - everything when the table fits the terminal, a slice with a footer when it does not. See `planWindow`. */
  window: RowWindow;
  /** The column `aircraft` is currently sorted by - highlighted in the header row so the active sort is visible while cycling with `[O]`. */
  sortKey: SortKey;
  /** Which way `sortKey` is ordered - shown as a `^`/`v` suffix on the highlighted header. */
  sortDirection: SortDirection;
  /** ICAO hex of the cursor row, moved with the arrow keys - highlighted with its own background. Undefined selects nothing. */
  selectedIcaoHex: string | undefined;
}

/**
 * Renders one column header cell. The header row shares one continuous blue
 * background (set on the row `Box` in {@link AircraftTable}) which this
 * inherits by default; the active sort column's `Box` overrides it with its
 * own yellow background instead of just coloring the `Text` inside it, so
 * the whole cell width - including the padding around the header label -
 * reads as a distinct chip within the bar, not just the label's own glyphs.
 * Its text uses an explicit hex black (`#000000`) rather than the named
 * ANSI `black`, which routes through the terminal's own customizable
 * 16-color palette - many terminal themes remap that slot to a soft gray,
 * which is indistinguishable from true black at a glance but reads as gray
 * against a bright background like this cell's yellow. It is also
 * deliberately not `bold`, since bold text in a base ANSI color commonly
 * renders as that color's bright variant on top of any palette remapping.
 */
function HeaderCell({
  column,
  active,
  direction,
}: {
  column: ColumnDef;
  active: boolean;
  direction: SortDirection;
}): ReactElement {
  return active ? (
    <Box width={column.width} backgroundColor="yellow">
      <Text color="#000000">
        {column.header} {direction === 'asc' ? '^' : 'v'}
      </Text>
    </Box>
  ) : (
    <Box width={column.width}>
      <Text bold color="white">
        {column.header}
      </Text>
    </Box>
  );
}

/**
 * Renders the header row's `|` column separator between two adjacent
 * cells. The padding space on each side of the pipe independently picks up
 * a yellow background when the column it sits against is the active sort
 * column, so the highlight reaches all the way to the pipe on that side
 * instead of leaving a blue gap between the highlighted cell and its
 * boundary - the pipe glyph itself always stays neutral.
 */
function HeaderSeparator({
  beforeActive,
  afterActive,
}: {
  beforeActive: boolean;
  afterActive: boolean;
}): ReactElement {
  return (
    <Text color="white">
      {beforeActive ? <Text backgroundColor="yellow"> </Text> : ' '}|
      {afterActive ? <Text backgroundColor="yellow"> </Text> : ' '}
    </Text>
  );
}

/**
 * Renders one aircraft's cell for `column`. The text style comes from
 * {@link rowTextStyle}, which resolves the row's emergency/cursor/watched/
 * new/stale flags by precedence and returns only the Ink props that apply,
 * so spreading it never passes a style prop as `undefined`. Cells are
 * separated by a right margin the width of the header row's ` | `
 * separator ({@link COLUMN_SEPARATOR_WIDTH}) so columns line up - the two
 * are visually the same column boundary and would drift out of alignment
 * if their widths could diverge; the last cell carries none, since a
 * trailing margin only pushes the row past the table's inner width and
 * makes Ink shrink (truncate) the first cell to compensate.
 */
function AircraftCell({
  column,
  aircraft,
  context,
  style,
  last,
}: {
  column: ColumnDef;
  aircraft: Aircraft;
  context: RenderContext;
  style: RowTextStyle;
  last: boolean;
}): ReactElement {
  return (
    <Box width={column.width} marginRight={last ? 0 : COLUMN_SEPARATOR_WIDTH}>
      <Text {...style} wrap="truncate-end">
        {column.render(aircraft, context)}
      </Text>
    </Box>
  );
}

/**
 * Renders one aircraft's full row. The cursor row gets its own cyan
 * background (full width, like the header bars) - a separate branch rather
 * than a conditional `backgroundColor` prop, so no Ink style prop is ever
 * passed as `undefined`. Its cells switch to black text so they read
 * against the cyan; emergency rows keep their bold red text instead, which
 * stays legible against cyan, so the two indicators don't fight each other
 * when a selected row is also squawking an emergency code. See
 * {@link rowTextStyle} for the full precedence.
 */
function AircraftRow({
  aircraft,
  columns,
  context,
  watchlist,
  firstSeenAt,
  staleAfterMs,
  selected,
}: {
  aircraft: Aircraft;
  columns: readonly ColumnDef[];
  context: RenderContext;
  watchlist: readonly string[];
  firstSeenAt: number | undefined;
  staleAfterMs: number;
  selected: boolean;
}): ReactElement {
  const style = rowTextStyle({
    emergency: isEmergencyAircraft(aircraft),
    selected,
    watched: matchesWatchlist(aircraft, watchlist),
    fresh: isFreshRow(firstSeenAt, context.nowMs),
    stale: isStaleRow(aircraft.lastSeenAt, context.nowMs, staleAfterMs),
  });
  const cells = columns.map((column, index) => (
    <AircraftCell
      key={column.key}
      column={column}
      aircraft={aircraft}
      context={context}
      style={style}
      last={index === columns.length - 1}
    />
  ));
  return selected ? (
    <Box width="100%" backgroundColor="cyan">
      {cells}
    </Box>
  ) : (
    <Box width="100%">{cells}</Box>
  );
}

/**
 * The live-updating aircraft table: a header row followed by one row per
 * tracked aircraft. Emergency aircraft render in bold red - see
 * {@link isEmergencyAircraft} - watched aircraft in bold yellow - see
 * {@link AircraftTableProps.watchlist} - newly tracked aircraft in green
 * for a few seconds, and aircraft going stale dimmed - see
 * {@link rowTextStyle}. The active sort column's header is
 * highlighted with a direction suffix - see {@link AircraftTableProps.sortKey}
 * and {@link AircraftTableProps.sortDirection}. The cursor row is highlighted
 * separately - see {@link AircraftTableProps.selectedIcaoHex}. The whole
 * table sits inside the same round cyan border the detail view and help
 * overlay use, so every main-area panel shares one frame. When the rows
 * do not fit the terminal, only {@link AircraftTableProps.window} is
 * rendered, with a footer saying which rows those are.
 *
 * @param props - The aircraft, columns, active sort key and direction, selected row, current time, and location to render.
 */
export function AircraftTable(props: AircraftTableProps): ReactElement {
  const context: RenderContext = {
    nowMs: props.nowMs,
    location: props.location,
    units: props.units,
  };
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box width="100%" backgroundColor="blue">
        {props.columns.map((column, index) => {
          const active = column.key === props.sortKey;
          const previousColumn = props.columns[index - 1];
          return (
            <Fragment key={column.key}>
              {index > 0 ? (
                <HeaderSeparator
                  beforeActive={previousColumn?.key === props.sortKey}
                  afterActive={active}
                />
              ) : undefined}
              <HeaderCell column={column} active={active} direction={props.sortDirection} />
            </Fragment>
          );
        })}
      </Box>
      {props.aircraft.length === 0 ? (
        <Text dimColor>No aircraft tracked yet.</Text>
      ) : (
        props.aircraft
          .slice(props.window.start, props.window.start + props.window.visibleRows)
          .map((aircraft) => (
            <AircraftRow
              key={aircraft.icaoHex}
              aircraft={aircraft}
              columns={props.columns}
              context={context}
              watchlist={props.watchlist}
              firstSeenAt={props.firstSeenAtByHex.get(aircraft.icaoHex)}
              staleAfterMs={props.staleAfterMs}
              selected={aircraft.icaoHex === props.selectedIcaoHex}
            />
          ))
      )}
      {isWindowed(props.window, props.aircraft.length) ? (
        <Text dimColor>
          {windowLabel(props.window, props.aircraft.length, 'rows')} (Up/Down, PgUp/PgDn, Home/End)
        </Text>
      ) : undefined}
    </Box>
  );
}
