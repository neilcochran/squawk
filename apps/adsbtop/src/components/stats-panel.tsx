import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import { formatStatsLines } from '../stats.js';
import type { SessionStatsInfo } from '../stats.js';

/** Props for {@link StatsPanel}: the session figures {@link formatStatsLines} renders. */
export type StatsPanelProps = SessionStatsInfo;

/**
 * Rows the panel occupies for `info`: top border, title, one per stats
 * line, bottom border. `App` subtracts this from the row budget while the
 * panel is shown.
 *
 * @param info - The session figures about to be rendered.
 * @returns The panel's height in rows.
 */
export function statsPanelHeight(info: SessionStatsInfo): number {
  return 3 + formatStatsLines(info).length;
}

/**
 * Split-view panel below the aircraft table, toggled by `[T]`, summarizing
 * the session: uptime, current/peak/unique aircraft counts, message totals
 * and rates with a sparkline of the recent rate window, and (with a
 * receiver location) the farthest aircraft seen. Purely presentational -
 * every line comes from {@link formatStatsLines}.
 *
 * @param props - The session figures.
 */
export function StatsPanel(props: StatsPanelProps): ReactElement {
  const lines = formatStatsLines(props);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        Session stats
      </Text>
      {lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
    </Box>
  );
}
