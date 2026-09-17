import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import type { Aircraft, Coordinates } from '@squawk/types';

import { buildDetailFields } from '../detail-fields.js';
import type { UnitSystem } from '../units.js';
import { isWindowed, windowLabel } from '../viewport.js';
import type { RowWindow } from '../viewport.js';

/** Props for {@link DetailView}. */
export interface DetailViewProps {
  /** The aircraft to show full detail for. */
  aircraft: Aircraft;
  /** Current time, for the "last seen" age. */
  nowMs: number;
  /** Configured receiver location (`--lat`/`--lon`), if any. Adds Distance/Bearing rows when set. */
  location: Coordinates | undefined;
  /** Update events observed for this aircraft since it was first tracked, for the Messages row. */
  messageCount: number;
  /** The unit system to render altitudes, speeds, and distances in. */
  units: UnitSystem;
  /** Which field rows to render - everything when they fit the terminal, a slice with a footer when they do not. See `planWindow`. */
  window: RowWindow;
}

/**
 * Full field dump for one aircraft, replacing the table area while open.
 * Opened with `[Enter]`/`[D]` on the selected row, closed the same way or
 * with `Escape`. When the rows do not fit the terminal, only
 * {@link DetailViewProps.window} is rendered, with a footer saying which
 * lines those are; `Up`/`Down` scroll it.
 *
 * @param props - The aircraft, the current time, the configured receiver location, and the aircraft's message count.
 */
export function DetailView({
  aircraft,
  nowMs,
  location,
  messageCount,
  units,
  window,
}: DetailViewProps): ReactElement {
  const fields = buildDetailFields(aircraft, nowMs, location, messageCount, units);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        {aircraft.icaoHex} detail
      </Text>
      {fields.slice(window.start, window.start + window.visibleRows).map((field) => (
        <Text key={field.label}>
          <Text bold>{field.label}:</Text> {field.value}
        </Text>
      ))}
      {isWindowed(window, fields.length) ? (
        <Text dimColor>{windowLabel(window, fields.length, 'lines')} (Up/Down to scroll)</Text>
      ) : undefined}
    </Box>
  );
}
