import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { HotkeyBar } from './hotkey-bar.js';

describe('HotkeyBar', () => {
  it('lists every always-active hotkey', () => {
    const { lastFrame } = render(
      <HotkeyBar paused={false} showMessages={false} hasActiveSearch={false} />,
    );

    const frame = lastFrame();
    expect(frame).toContain('[O]');
    expect(frame).toContain('[C]');
    expect(frame).toContain('[P]');
    expect(frame).toContain('[S]');
    expect(frame).toContain('[M]');
    expect(frame).toContain('[D]');
    expect(frame).toContain('[H]');
    expect(frame).toContain('[Q]');
    expect(frame).toContain('Pause');
  });

  it('shows Resume instead of Pause when already paused', () => {
    const { lastFrame } = render(<HotkeyBar paused showMessages={false} hasActiveSearch={false} />);

    expect(lastFrame()).toContain('Resume');
  });

  it('omits [N]ext match until a search has been submitted', () => {
    const withoutSearch = render(
      <HotkeyBar paused={false} showMessages={false} hasActiveSearch={false} />,
    );
    expect(withoutSearch.lastFrame()).not.toContain('[N]');

    const withSearch = render(<HotkeyBar paused={false} showMessages={false} hasActiveSearch />);
    expect(withSearch.lastFrame()).toContain('[N]');
  });

  it('omits [V]erbosity until the messages panel is shown', () => {
    const withoutMessages = render(
      <HotkeyBar paused={false} showMessages={false} hasActiveSearch={false} />,
    );
    expect(withoutMessages.lastFrame()).not.toContain('[V]');

    const withMessages = render(<HotkeyBar paused={false} showMessages hasActiveSearch={false} />);
    expect(withMessages.lastFrame()).toContain('[V]');
    expect(withMessages.lastFrame()).toContain('Hide msgs');
  });
});
