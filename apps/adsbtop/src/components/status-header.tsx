import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import { formatStatusLine } from '../status-line.js';
import type { StatusLineInfo } from '../status-line.js';

/** Props for {@link StatusHeader}. */
export interface StatusHeaderProps extends StatusLineInfo {
  /** Whether the table is currently paused. */
  paused: boolean;
}

/**
 * Connection and activity summary shown above the aircraft table:
 * source/host/port, tracked aircraft count, message rate, and time since the
 * last update, followed by a blank line (same background) to give the table
 * header row below it some breathing room.
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
        <Text color="white">{formatStatusLine(props)}</Text>
        {props.paused ? (
          <Text bold color="yellow">
            {'  PAUSED'}
          </Text>
        ) : undefined}
      </Box>
      <Box width="100%" backgroundColor="blue" height={1} />
    </Box>
  );
}
