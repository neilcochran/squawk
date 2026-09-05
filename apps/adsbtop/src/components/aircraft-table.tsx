import { Box, Text } from 'ink';
import { Fragment } from 'react';
import type { ReactElement } from 'react';

import type { Aircraft } from '@squawk/types';

import type { ColumnDef, SortKey } from '../columns.js';
import { isEmergencySquawk } from '../format.js';

/**
 * Width of the header row's `|` column separator (a space, the pipe, and
 * another space - see {@link HeaderSeparator}). `AircraftCell`'s
 * `marginRight` is derived from this so a data row's column gap always
 * matches the header's separator width - the two are visually the same
 * column boundary and would drift out of alignment if their widths could
 * diverge. Keep this in sync with `HeaderSeparator`'s own rendered width if
 * that ever changes.
 */
const HEADER_SEPARATOR_WIDTH = ' | '.length;

/** Props for {@link AircraftTable}. */
export interface AircraftTableProps {
  /** Aircraft to render, already sorted in display order. */
  aircraft: readonly Aircraft[];
  /** Columns to render, in display order. */
  columns: readonly ColumnDef[];
  /** Current time, passed through to age-relative column renderers. */
  nowMs: number;
  /** The column `aircraft` is currently sorted by - highlighted in the header row so the active sort is visible while cycling with `[O]`. */
  sortKey: SortKey;
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
function HeaderCell({ column, active }: { column: ColumnDef; active: boolean }): ReactElement {
  return active ? (
    <Box width={column.width} backgroundColor="yellow">
      <Text color="#000000">{column.header}</Text>
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
 * Renders one aircraft's cell for `column`. A declared emergency squawk
 * (7500/7600/7700) renders in bold red - this is a full separate `<Text>`
 * branch rather than a conditionally-`undefined` `color` prop, since Ink's
 * `color`/`bold` props are only ever fully present or fully omitted here.
 */
function AircraftCell({
  column,
  aircraft,
  nowMs,
  emergency,
}: {
  column: ColumnDef;
  aircraft: Aircraft;
  nowMs: number;
  emergency: boolean;
}): ReactElement {
  const value = column.render(aircraft, nowMs);
  return (
    <Box width={column.width} marginRight={HEADER_SEPARATOR_WIDTH}>
      {emergency ? (
        <Text color="red" bold wrap="truncate-end">
          {value}
        </Text>
      ) : (
        <Text wrap="truncate-end">{value}</Text>
      )}
    </Box>
  );
}

/**
 * Renders one aircraft's full row. The cursor row gets its own cyan
 * background (full width, like the header bars) - a separate branch rather
 * than a conditional `backgroundColor` prop, matching {@link AircraftCell}'s
 * established convention of never passing Ink style props as `undefined`.
 * Cyan stays legible against emergency rows' bold red text, so the two
 * indicators don't fight each other when a selected row is also squawking
 * an emergency code.
 */
function AircraftRow({
  aircraft,
  columns,
  nowMs,
  selected,
}: {
  aircraft: Aircraft;
  columns: readonly ColumnDef[];
  nowMs: number;
  selected: boolean;
}): ReactElement {
  const emergency = isEmergencySquawk(aircraft.squawk);
  const cells = columns.map((column) => (
    <AircraftCell
      key={column.key}
      column={column}
      aircraft={aircraft}
      nowMs={nowMs}
      emergency={emergency}
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
 * tracked aircraft. Rows squawking a declared emergency code render in bold
 * red - see {@link isEmergencySquawk}. The active sort column's header is
 * highlighted - see {@link AircraftTableProps.sortKey}. The cursor row is
 * highlighted separately - see {@link AircraftTableProps.selectedIcaoHex}.
 *
 * @param props - The aircraft, columns, active sort key, selected row, and current time to render.
 */
export function AircraftTable(props: AircraftTableProps): ReactElement {
  return (
    <Box flexDirection="column">
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
              <HeaderCell column={column} active={active} />
            </Fragment>
          );
        })}
      </Box>
      {props.aircraft.length === 0 ? (
        <Text dimColor>No aircraft tracked yet.</Text>
      ) : (
        props.aircraft.map((aircraft) => (
          <AircraftRow
            key={aircraft.icaoHex}
            aircraft={aircraft}
            columns={props.columns}
            nowMs={props.nowMs}
            selected={aircraft.icaoHex === props.selectedIcaoHex}
          />
        ))
      )}
    </Box>
  );
}
