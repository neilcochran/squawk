import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import type { MessageLogEntry } from '../aircraft-state.js';
import { formatMessageLogLine } from '../format.js';

/** Number of log lines shown at once - older entries scroll off the top as new ones arrive. */
const VISIBLE_ROWS = 8;

/** Verbosity levels for {@link MessagesPanel}, toggled by `[V]`. */
export type MessageVerbosity = 'newAndLost' | 'all';

/** Props for {@link MessagesPanel}. */
export interface MessagesPanelProps {
  /**
   * The log to render, oldest first - already scoped to the active
   * verbosity by the caller (`view.newAndLostLog` or `view.messageLog`),
   * not filtered here. The two are separately-maintained logs, not one log
   * filtered two ways - see {@link MessageVerbosity} and
   * `AircraftTableState.newAndLostLog`'s doc comment for why.
   */
  entries: readonly MessageLogEntry[];
  /** Which verbosity `entries` was scoped to - used only for the header label here. */
  verbosity: MessageVerbosity;
}

/**
 * Split-view panel below the aircraft table, toggled by `[M]`, showing the
 * most recent decoded feed events. Always shows the last {@link VISIBLE_ROWS}
 * entries - there is no scroll-back, matching a live `tail -f`-style log
 * rather than a browsable history.
 *
 * @param props - The already-verbosity-scoped log to render, and which verbosity it is.
 */
export function MessagesPanel({ entries, verbosity }: MessagesPanelProps): ReactElement {
  const visible = entries.slice(-VISIBLE_ROWS);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        Messages {verbosity === 'newAndLost' ? '(new/lost)' : '(all)'}
      </Text>
      {visible.length === 0 ? (
        <Text dimColor>No messages yet.</Text>
      ) : (
        visible.map((entry) => <Text key={entry.id}>{formatMessageLogLine(entry)}</Text>)
      )}
    </Box>
  );
}
