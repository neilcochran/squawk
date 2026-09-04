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
}

/**
 * htop-style hotkey bar shown below the aircraft table, listing every
 * currently-active single-key action.
 *
 * @param props - Whether the table is paused, for the pause/resume label.
 */
export function HotkeyBar({ paused }: HotkeyBarProps): ReactElement {
  const hotkeys: readonly Hotkey[] = [
    { key: 'O', label: 'Sort' },
    { key: 'C', label: 'Columns' },
    { key: 'P', label: paused ? 'Resume' : 'Pause' },
    { key: 'H', label: 'Help' },
    { key: 'Q', label: 'Quit' },
  ];

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
