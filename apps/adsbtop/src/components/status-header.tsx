import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import type { ConnectionState } from '@squawk/adsb-feed';

import { formatStatusLine } from '../status-line.js';
import type { StatusLineInfo } from '../status-line.js';

/** Props for {@link StatusHeader}. */
export interface StatusHeaderProps extends StatusLineInfo {
  /** Whether the table is currently paused - shows a "PAUSED" {@link AlertChip}, so a frozen table is hard to miss. */
  paused: boolean;
  /** The feed's current connection state - shows a "RECONNECTING" {@link AlertChip} when not connected. Nothing is shown while connected. */
  connectionState: ConnectionState;
}

/**
 * A black-on-red chip for the status bar's attention-grabbing states
 * (paused, reconnecting). Red on the bar's blue background reads as a
 * distinct box rather than a differently-colored word, which plain colored
 * text did not. The text uses explicit hex black rather than the named ANSI
 * `black`, for the same palette-remapping reason as the table's active sort
 * header - see `HeaderCell` in `aircraft-table.tsx`. Callers place the
 * surrounding spacing outside the chip so the red box hugs the label.
 *
 * @param props - The label to show inside the chip.
 */
function AlertChip({ label }: { label: string }): ReactElement {
  return (
    <Text backgroundColor="red" color="#000000">
      {` ${label} `}
    </Text>
  );
}

/**
 * Connection and activity summary shown above the aircraft table:
 * source/host/port, tracked aircraft count, total message count, message
 * rate, and time since the last update, followed by a blank line (same
 * background) to give the table header row below it some breathing room.
 * A RECONNECTING chip appears before the summary while the feed is down and
 * a PAUSED chip after it while the table is frozen - see {@link AlertChip}.
 *
 * @param props - The connection/activity state to display.
 */
export function StatusHeader(props: StatusHeaderProps): ReactElement {
  return (
    <Box flexDirection="column">
      <Box width="100%" backgroundColor="blue">
        <Text bold color="white">
          {'adsbtop  '}
        </Text>
        {props.connectionState === 'reconnecting' ? (
          <Text>
            <AlertChip label="RECONNECTING" />
            {'  '}
          </Text>
        ) : undefined}
        <Text color="white">{formatStatusLine(props)}</Text>
        {props.paused ? (
          <Text>
            {'  '}
            <AlertChip label="PAUSED" />
          </Text>
        ) : undefined}
      </Box>
      <Box width="100%" backgroundColor="blue" height={1} />
    </Box>
  );
}
