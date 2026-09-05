import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import type { PositionHistoryEntry } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import { buildDetailFields } from '../detail-fields.js';
import { buildAltitudeSparkline } from '../sparkline.js';

/** Props for {@link DetailView}. */
export interface DetailViewProps {
  /** The aircraft to show full detail for. */
  aircraft: Aircraft;
  /** Position history for the altitude sparkline, oldest first. */
  positionHistory: readonly PositionHistoryEntry[];
  /** Current time, for the "last seen" age. */
  nowMs: number;
}

/**
 * Full field dump for one aircraft, replacing the table area while open.
 * Opened with `[Enter]`/`[D]` on the selected row, closed the same way or
 * with `Escape`.
 *
 * @param props - The aircraft, its position history, and the current time.
 */
export function DetailView({ aircraft, positionHistory, nowMs }: DetailViewProps): ReactElement {
  const fields = buildDetailFields(aircraft, nowMs);
  const sparkline = buildAltitudeSparkline(positionHistory);

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
      <Text bold>Altitude history:</Text>
      <Text>{sparkline === '' ? 'No altitude history yet.' : sparkline}</Text>
    </Box>
  );
}
