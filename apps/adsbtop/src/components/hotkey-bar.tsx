import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

/** One hotkey entry shown in {@link HotkeyBar}. */
interface Hotkey {
  /** The key to press. */
  key: string;
  /** Short label describing what it does. */
  label: string;
}

/** Props for {@link HotkeyBar}. */
export interface HotkeyBarProps {
  /** Whether the table is currently paused - swaps the pause hotkey's label to "Resume". */
  paused: boolean;
  /** Whether the messages panel is currently shown - swaps its label and reveals `[V]erbosity`. */
  showMessages: boolean;
  /** Whether a search has been submitted - reveals `[N]ext match` for cycling. */
  hasActiveSearch: boolean;
}

/**
 * htop-style hotkey bar shown below the aircraft table, listing every
 * currently-active single-key action. `[N]ext match` and `[V]erbosity` only
 * appear while they would actually do something, keeping the bar accurate
 * to what a keypress does right now rather than listing every hotkey that
 * exists anywhere in the app.
 *
 * @param props - Pause/messages/search state, for the conditional labels and entries.
 */
export function HotkeyBar({ paused, showMessages, hasActiveSearch }: HotkeyBarProps): ReactElement {
  const hotkeys: Hotkey[] = [
    { key: 'O', label: 'Sort' },
    { key: 'C', label: 'Columns' },
    { key: 'P', label: paused ? 'Resume' : 'Pause' },
    { key: 'S', label: 'Search' },
  ];
  if (hasActiveSearch) {
    hotkeys.push({ key: 'N', label: 'Next match' });
  }
  hotkeys.push({ key: 'M', label: showMessages ? 'Hide msgs' : 'Messages' });
  if (showMessages) {
    hotkeys.push({ key: 'V', label: 'Verbosity' });
  }
  hotkeys.push(
    { key: 'D', label: 'Detail' },
    { key: 'H', label: 'Help' },
    { key: 'Q', label: 'Quit' },
  );

  return (
    <Box>
      {hotkeys.map((hotkey, index) => (
        <Text key={hotkey.key}>
          <Text bold color="cyan">
            [{hotkey.key}]
          </Text>
          {hotkey.label}
          {index < hotkeys.length - 1 ? '  ' : ''}
        </Text>
      ))}
    </Box>
  );
}
