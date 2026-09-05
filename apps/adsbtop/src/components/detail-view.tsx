import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import type { Aircraft, Coordinates } from '@squawk/types';

import { buildDetailFields } from '../detail-fields.js';

/** Props for {@link DetailView}. */
export interface DetailViewProps {
  /** The aircraft to show full detail for. */
  aircraft: Aircraft;
  /** Current time, for the "last seen" age. */
  nowMs: number;
  /** Configured receiver location (`--lat`/`--lon`), if any. Adds Distance/Bearing rows when set. */
  location: Coordinates | undefined;
}

/**
 * Full field dump for one aircraft, replacing the table area while open.
 * Opened with `[Enter]`/`[D]` on the selected row, closed the same way or
 * with `Escape`.
 *
 * @param props - The aircraft, the current time, and the configured receiver location.
 */
export function DetailView({ aircraft, nowMs, location }: DetailViewProps): ReactElement {
  const fields = buildDetailFields(aircraft, nowMs, location);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        {aircraft.icaoHex} detail
      </Text>
      {fields.map((field) => (
        <Text key={field.label}>
          <Text bold>{field.label}:</Text> {field.value}
        </Text>
      ))}
    </Box>
  );
}
