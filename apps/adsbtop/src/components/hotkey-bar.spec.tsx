import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { HotkeyBar } from './hotkey-bar.js';

describe('HotkeyBar', () => {
  it('lists every active hotkey', () => {
    const { lastFrame } = render(<HotkeyBar paused={false} />);

    const frame = lastFrame();
    expect(frame).toContain('[O]');
    expect(frame).toContain('[C]');
    expect(frame).toContain('[P]');
    expect(frame).toContain('[H]');
    expect(frame).toContain('[Q]');
    expect(frame).toContain('Pause');
  });

  it('shows Resume instead of Pause when already paused', () => {
    const { lastFrame } = render(<HotkeyBar paused />);

    expect(lastFrame()).toContain('Resume');
  });
});
