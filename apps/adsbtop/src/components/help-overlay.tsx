import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

/** One entry in the help overlay. */
interface HelpEntry {
  /** The key to press. */
  key: string;
  /** What pressing it does. */
  description: string;
}

const HELP_ENTRIES: readonly HelpEntry[] = [
  { key: 'Up/Down', description: 'Move the row cursor' },
  { key: 'O', description: 'Cycle sort column (ICAO, callsign, altitude, ground speed, age)' },
  { key: 'C', description: 'Toggle compact columns for narrow terminals' },
  { key: 'P', description: 'Pause/resume the table - the feed keeps running underneath' },
  {
    key: 'S',
    description: 'Search by ICAO hex, callsign, squawk, or N-number - jumps to the first match',
  },
  { key: 'N / Shift+N', description: 'Jump to the next/previous search match' },
  { key: 'M', description: 'Toggle the messages panel (recent new/update/lost events)' },
  { key: 'V', description: 'Toggle messages panel verbosity (new/lost only vs. every update)' },
  { key: 'Enter / D', description: "Show the cursor row's full detail view" },
  { key: 'H', description: 'Toggle this help overlay' },
  { key: 'Q', description: 'Quit adsbtop' },
];

/** Bordered keybinding legend, toggled by the `[H]` hotkey. */
export function HelpOverlay(): ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        adsbtop help
      </Text>
      {HELP_ENTRIES.map((entry) => (
        <Text key={entry.key}>
          <Text bold>[{entry.key}]</Text> {entry.description}
        </Text>
      ))}
    </Box>
  );
}
