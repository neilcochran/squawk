import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import type { ColumnDef, ColumnKey } from '../columns.js';

/** Width the short header is padded to in each picker row, so the full names line up in their own column. */
const HEADER_LABEL_WIDTH = 9;

/** Props for {@link ColumnPicker}. */
export interface ColumnPickerProps {
  /** Columns that can render this session, in display order - the rows the cursor moves through. */
  availableColumns: readonly ColumnDef[];
  /** Location-gated columns that cannot render without `--lat`/`--lon`, listed dimmed after the available rows so the user knows they exist. */
  unavailableColumns: readonly ColumnDef[];
  /** Keys of the columns currently shown in the table. */
  selectedKeys: readonly ColumnKey[];
  /** Index into `availableColumns` of the cursor row. */
  cursorIndex: number;
  /** Whether the shown set is auto-fitted to the terminal width rather than chosen explicitly. */
  autoFit: boolean;
  /** The terminal's current width in columns, for the fit summary line. */
  terminalWidth: number;
  /** Terminal columns the current table occupies, border and padding included, for the fit summary line. */
  tableWidth: number;
}

/**
 * One picker row: a checkbox, the column's short header as it appears in
 * the table, and its full name so abbreviations like `Brg` and `CPA` are
 * never ambiguous. The cursor row takes the same cyan background and black
 * text as the table's cursor row, as a separate branch rather than a
 * conditional style prop, matching the table's convention of never passing
 * Ink style props as `undefined`.
 */
function PickerRow({
  column,
  selected,
  cursor,
}: {
  column: ColumnDef;
  selected: boolean;
  cursor: boolean;
}): ReactElement {
  const label = `[${selected ? 'x' : ' '}] ${column.header.padEnd(HEADER_LABEL_WIDTH)} ${column.name}`;
  return cursor ? (
    <Box width="100%" backgroundColor="cyan">
      <Text color="#000000">{label}</Text>
    </Box>
  ) : (
    <Box width="100%">
      <Text>{label}</Text>
    </Box>
  );
}

/**
 * The `[C]olumns` picker overlay: every available column with a checkbox,
 * a summary of how the current set fits the terminal, and the picker's own
 * key legend. Purely presentational - the cursor and selection live in
 * `App`, which also handles the picker's keys.
 *
 * @param props - The available and unavailable columns, current selection, cursor, and fit figures.
 */
export function ColumnPicker(props: ColumnPickerProps): ReactElement {
  const shownCount = props.selectedKeys.length;
  const totalCount = props.availableColumns.length;
  const fit = `table ${props.tableWidth} of ${props.terminalWidth} wide`;
  const summary = props.autoFit
    ? `Auto-fit on: showing ${shownCount} of ${totalCount} columns (${fit})`
    : `Custom selection: ${shownCount} of ${totalCount} columns (${fit})`;
  const overflow = props.tableWidth > props.terminalWidth;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        adsbtop columns
      </Text>
      {overflow ? (
        <Text color="yellow">{summary} - wider than the terminal, cells will truncate</Text>
      ) : (
        <Text>{summary}</Text>
      )}
      {props.availableColumns.map((column, index) => (
        <PickerRow
          key={column.key}
          column={column}
          selected={props.selectedKeys.includes(column.key)}
          cursor={index === props.cursorIndex}
        />
      ))}
      {props.unavailableColumns.map((column) => (
        <Text key={column.key} dimColor>
          {`[ ] ${column.header.padEnd(HEADER_LABEL_WIDTH)} ${column.name} (needs --lat/--lon)`}
        </Text>
      ))}
      <Text>
        <Text bold color="cyan">
          [Space]
        </Text>
        Toggle{'  '}
        <Text bold color="cyan">
          [A]
        </Text>
        All{'  '}
        <Text bold color="cyan">
          [M]
        </Text>
        Minimal{'  '}
        <Text bold color="cyan">
          [F]
        </Text>
        Auto-fit{'  '}
        <Text bold color="cyan">
          [Esc]
        </Text>
        Close
      </Text>
    </Box>
  );
}
