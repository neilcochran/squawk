import { describe, expect, it } from 'vitest';

import { nextInCycle } from './cycle.js';

describe('nextInCycle', () => {
  it('steps to the following item', () => {
    expect(nextInCycle(['a', 'b', 'c'], 'a')).toBe('b');
    expect(nextInCycle(['a', 'b', 'c'], 'b')).toBe('c');
  });

  it('wraps from the last item back to the first', () => {
    expect(nextInCycle(['a', 'b', 'c'], 'c')).toBe('a');
  });

  it('stays put in a list of one', () => {
    expect(nextInCycle(['only'], 'only')).toBe('only');
  });

  it('steps to the first item when the current one is not in the list', () => {
    expect(nextInCycle(['a', 'b', 'c'], 'z')).toBe('a');
  });

  it('compares by identity, so it works for objects', () => {
    const first = { id: 1 };
    const second = { id: 2 };

    expect(nextInCycle([first, second], first)).toBe(second);
  });
});
