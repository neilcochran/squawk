import type { RangeDirection } from '../scope/range.js';

/**
 * The keys that step the scope range. `=` and `_` are included so zooming
 * works with or without Shift held, and `]`/`[` as a one-handed alternative.
 */
export const RANGE_KEYS: Record<RangeDirection, readonly string[]> = {
  in: ['+', '=', ']'],
  out: ['-', '_', '['],
};

/**
 * Maps a key press to a range change, per {@link RANGE_KEYS}.
 *
 * @param key - The `KeyboardEvent.key` value.
 * @returns The direction to step the range, or undefined if the key is not a range key.
 */
export function rangeKeyDirection(key: string): RangeDirection | undefined {
  if (RANGE_KEYS.in.includes(key)) {
    return 'in';
  }
  if (RANGE_KEYS.out.includes(key)) {
    return 'out';
  }
  return undefined;
}
