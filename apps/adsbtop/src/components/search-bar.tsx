import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { ReactElement } from 'react';

/** Props for {@link SearchBar}. */
export interface SearchBarProps {
  /** The in-progress query text. */
  query: string;
  /** Called with the updated query on every keystroke. */
  onChange: (query: string) => void;
  /** Called with the submitted query when `Enter` is pressed. */
  onSubmit: (query: string) => void;
}

/**
 * `[S]earch` prompt line shown in place of the hotkey bar while composing a
 * query. `Escape` cancels - handled by the app's own `useInput`, not here,
 * since `ink-text-input` has no built-in cancel key.
 *
 * @param props - The in-progress query and change/submit callbacks.
 */
export function SearchBar({ query, onChange, onSubmit }: SearchBarProps): ReactElement {
  return (
    <Box>
      <Text bold color="cyan">
        Search:{' '}
      </Text>
      <TextInput value={query} onChange={onChange} onSubmit={onSubmit} focus />
    </Box>
  );
}
