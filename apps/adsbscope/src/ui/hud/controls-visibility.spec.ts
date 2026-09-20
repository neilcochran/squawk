import { describe, expect, it, vi } from 'vitest';

import { startsWithControlsShowing, WIDE_SCREEN_QUERY } from './controls-visibility.js';

describe('startsWithControlsShowing', () => {
  it('shows the controls on a wide screen and hides them on a narrow one', () => {
    const wide = vi.fn(() => ({ matches: true }));
    const narrow = vi.fn(() => ({ matches: false }));

    expect(startsWithControlsShowing(wide)).toBe(true);
    expect(startsWithControlsShowing(narrow)).toBe(false);
    expect(wide).toHaveBeenCalledWith(WIDE_SCREEN_QUERY);
  });

  it('shows the controls where the screen cannot be asked about', () => {
    expect(startsWithControlsShowing(undefined)).toBe(true);
  });
});
