import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import type { SortDirection } from '../columns.js';
import type { UnitSystem } from '../units.js';

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
  /** The active sort direction - the `[R]` label names the direction pressing it switches to. */
  sortDirection: SortDirection;
  /** Whether the messages panel is currently shown - swaps its label and reveals `[V]erbosity`. */
  showMessages: boolean;
  /** Whether the stats panel is currently shown - swaps the `[T]` label between "Stats" and "Hide stats". */
  showStats: boolean;
  /** Whether the status bar is currently shown - swaps the `[B]` label between "Status" and "Hide status". */
  showStatus: boolean;
  /** Whether a search has been submitted - reveals `[N]ext match` for cycling. */
  hasActiveSearch: boolean;
  /** Whether a filter is narrowing the table - swaps the `[F]` label between "Filter" and "Edit filter". */
  hasActiveFilter: boolean;
  /** The active unit system - the `[U]` label names the system pressing it switches to. */
  units: UnitSystem;
}

/**
 * htop-style hotkey bar shown below the aircraft table, listing every
 * currently-active single-key action. `[N]ext match` and `[V]erbosity` only
 * appear while they would actually do something, keeping the bar accurate
 * to what a keypress does right now rather than listing every hotkey that
 * exists anywhere in the app. Entries wrap onto further lines in a narrow
 * terminal rather than each shrinking to fit one line, since a truncated
 * label like `Hide statu` is worse than a second row.
 *
 * @param props - Pause/sort/messages/stats/status/search/filter state, for the conditional labels and entries.
 */
export function HotkeyBar({
  paused,
  sortDirection,
  showMessages,
  showStats,
  showStatus,
  hasActiveSearch,
  hasActiveFilter,
  units,
}: HotkeyBarProps): ReactElement {
  const hotkeys: Hotkey[] = [
    { key: 'O', label: 'Sort' },
    { key: 'R', label: sortDirection === 'asc' ? 'Desc' : 'Asc' },
    { key: 'C', label: 'Columns' },
    { key: 'P', label: paused ? 'Resume' : 'Pause' },
    { key: 'S', label: 'Search' },
  ];
  if (hasActiveSearch) {
    hotkeys.push({ key: 'N', label: 'Next match' });
  }
  hotkeys.push({ key: 'F', label: hasActiveFilter ? 'Edit filter' : 'Filter' });
  hotkeys.push({ key: 'M', label: showMessages ? 'Hide msgs' : 'Messages' });
  if (showMessages) {
    hotkeys.push({ key: 'V', label: 'Verbosity' });
  }
  hotkeys.push({ key: 'T', label: showStats ? 'Hide stats' : 'Stats' });
  hotkeys.push({ key: 'W', label: 'Snapshot' });
  hotkeys.push({ key: 'U', label: units === 'aviation' ? 'Metric' : 'Aviation' });
  hotkeys.push({ key: 'B', label: showStatus ? 'Hide status' : 'Status' });
  hotkeys.push(
    { key: 'D', label: 'Detail' },
    { key: 'H', label: 'Help' },
    { key: 'Q', label: 'Quit' },
  );

  return (
    <Box flexWrap="wrap">
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
