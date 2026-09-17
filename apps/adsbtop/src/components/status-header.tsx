import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import type { ConnectionState } from '@squawk/adsb-feed';

import { formatStatusLine } from '../status-line.js';
import type { StatusLineInfo } from '../status-line.js';

/** A short-lived message shown as a chip at the end of the status bar - the outcome of a `[W]` snapshot or a `--record` failure. */
export interface StatusNotice {
  /** The message. */
  text: string;
  /** Green for success, red for failure. */
  kind: 'ok' | 'error';
}

/** Props for {@link StatusHeader}. */
export interface StatusHeaderProps extends StatusLineInfo {
  /** Whether the table is currently paused - shows a "PAUSED" {@link AlertChip}, so a frozen table is hard to miss. */
  paused: boolean;
  /** The feed's current connection state - shows a "RECONNECTING" {@link AlertChip} when not connected. Nothing is shown while connected. */
  connectionState: ConnectionState;
  /** A transient outcome to show as a chip after the summary, or undefined for none. `App` clears it a few seconds after setting it. */
  notice: StatusNotice | undefined;
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
 * The chip for a {@link StatusNotice}: green for a success, red for a
 * failure, black text for the same palette reason as {@link AlertChip}.
 */
function NoticeChip({ notice }: { notice: StatusNotice }): ReactElement {
  return notice.kind === 'ok' ? (
    <Text backgroundColor="green" color="#000000">
      {` ${notice.text} `}
    </Text>
  ) : (
    <Text backgroundColor="red" color="#000000">
      {` ${notice.text} `}
    </Text>
  );
}

/**
 * Connection and activity summary shown above the aircraft table:
 * source/host/port, tracked aircraft count, total message count, message
 * rate, and time since the last update, followed by a second line (same
 * background) that gives the table header row below it some breathing room
 * and carries the chips: RECONNECTING while the feed is down and PAUSED
 * while the table is frozen (see {@link AlertChip}), then any transient
 * {@link NoticeChip} (snapshot saved, record failed). Chips live on their
 * own line rather than beside the summary because a narrow terminal wraps
 * the summary, and Ink then shrinks whatever shares its row - the label
 * lost letters and chips collided with the text. The label is pinned with
 * `flexShrink={0}` for the same reason.
 *
 * @param props - The connection/activity state to display.
 */
export function StatusHeader(props: StatusHeaderProps): ReactElement {
  return (
    <Box flexDirection="column">
      <Box width="100%" backgroundColor="blue">
        <Box flexShrink={0}>
          <Text bold color="white">
            {'adsbtop  '}
          </Text>
        </Box>
        <Text color="white">{formatStatusLine(props)}</Text>
      </Box>
      <Box width="100%" backgroundColor="blue" height={1}>
        {props.connectionState === 'reconnecting' ? (
          <Text>
            <AlertChip label="RECONNECTING" />
            {'  '}
          </Text>
        ) : undefined}
        {props.paused ? (
          <Text>
            <AlertChip label="PAUSED" />
            {'  '}
          </Text>
        ) : undefined}
        {props.notice !== undefined ? <NoticeChip notice={props.notice} /> : undefined}
      </Box>
    </Box>
  );
}
