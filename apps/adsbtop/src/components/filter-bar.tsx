import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { ReactElement } from 'react';

/** Props for {@link FilterBar}. */
export interface FilterBarProps {
  /** The in-progress filter text. */
  query: string;
  /** Why the last submitted text was rejected, shown in red under the prompt until the next edit; undefined when there is no error. */
  error: string | undefined;
  /** Called with the updated text on every keystroke. */
  onChange: (query: string) => void;
  /** Called with the submitted text when `Enter` is pressed. */
  onSubmit: (query: string) => void;
}

/** One-line reminder of the filter syntax, shown under the prompt while there is no error. */
const SYNTAX_HINT =
  'is:airborne (is:air)  is:ground (is:gnd)  is:emergency (is:emerg)  within:<nm>  text  (empty clears)';

/**
 * `[F]ilter` prompt shown in place of the hotkey bar while composing a
 * filter, with the syntax hint or the last rejection reason on the line
 * below. `Escape` cancels - handled by the app's own `useInput`, not here,
 * since `ink-text-input` has no built-in cancel key.
 *
 * @param props - The in-progress text, any rejection reason, and the change/submit callbacks.
 */
export function FilterBar({ query, error, onChange, onSubmit }: FilterBarProps): ReactElement {
  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color="cyan">
          Filter:{' '}
        </Text>
        <TextInput value={query} onChange={onChange} onSubmit={onSubmit} focus />
      </Box>
      {error === undefined ? <Text dimColor>{SYNTAX_HINT}</Text> : <Text color="red">{error}</Text>}
    </Box>
  );
}
