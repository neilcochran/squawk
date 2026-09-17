import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { HotkeyBar } from './hotkey-bar.js';

describe('HotkeyBar', () => {
  it('lists every always-active hotkey', () => {
    const { lastFrame } = render(
      <HotkeyBar
        paused={false}
        sortDirection="asc"
        showMessages={false}
        showStats={false}
        showStatus
        hasActiveSearch={false}
        hasActiveFilter={false}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('[O]');
    expect(frame).toContain('[R]');
    expect(frame).toContain('[C]');
    expect(frame).toContain('[P]');
    expect(frame).toContain('[S]');
    expect(frame).toContain('[F]');
    expect(frame).toContain('Filter');
    expect(frame).toContain('[M]');
    expect(frame).toContain('[T]');
    expect(frame).toContain('Stats');
    expect(frame).toContain('[W]');
    expect(frame).toContain('Snapshot');
    expect(frame).toContain('[B]');
    expect(frame).toContain('[D]');
    expect(frame).toContain('[H]');
    expect(frame).toContain('[Q]');
    expect(frame).toContain('Pause');
  });

  it('shows Resume instead of Pause when already paused', () => {
    const { lastFrame } = render(
      <HotkeyBar
        paused
        sortDirection="asc"
        showMessages={false}
        showStats={false}
        showStatus
        hasActiveSearch={false}
        hasActiveFilter={false}
      />,
    );

    expect(lastFrame()).toContain('Resume');
  });

  it('labels [R] with the direction pressing it switches to', () => {
    const ascending = render(
      <HotkeyBar
        paused={false}
        sortDirection="asc"
        showMessages={false}
        showStats={false}
        showStatus
        hasActiveSearch={false}
        hasActiveFilter={false}
      />,
    );
    expect(ascending.lastFrame()).toContain('[R]Desc');

    const descending = render(
      <HotkeyBar
        paused={false}
        sortDirection="desc"
        showMessages={false}
        showStats={false}
        showStatus
        hasActiveSearch={false}
        hasActiveFilter={false}
      />,
    );
    expect(descending.lastFrame()).toContain('[R]Asc');
  });

  it('labels [B] by whether the status bar is currently shown', () => {
    const shown = render(
      <HotkeyBar
        paused={false}
        sortDirection="asc"
        showMessages={false}
        showStats={false}
        showStatus
        hasActiveSearch={false}
        hasActiveFilter={false}
      />,
    );
    expect(shown.lastFrame()).toContain('[B]Hide status');

    const hidden = render(
      <HotkeyBar
        paused={false}
        sortDirection="asc"
        showMessages={false}
        showStats={false}
        showStatus={false}
        hasActiveSearch={false}
        hasActiveFilter={false}
      />,
    );
    expect(hidden.lastFrame()).toContain('[B]Status');
    expect(hidden.lastFrame()).not.toContain('Hide status');
  });

  it('omits [N]ext match until a search has been submitted', () => {
    const withoutSearch = render(
      <HotkeyBar
        paused={false}
        sortDirection="asc"
        showMessages={false}
        showStats={false}
        showStatus
        hasActiveSearch={false}
        hasActiveFilter={false}
      />,
    );
    expect(withoutSearch.lastFrame()).not.toContain('[N]');

    const withSearch = render(
      <HotkeyBar
        paused={false}
        sortDirection="asc"
        showMessages={false}
        showStats={false}
        showStatus
        hasActiveSearch
        hasActiveFilter={false}
      />,
    );
    expect(withSearch.lastFrame()).toContain('[N]');
  });

  it('omits [V]erbosity until the messages panel is shown', () => {
    const withoutMessages = render(
      <HotkeyBar
        paused={false}
        sortDirection="asc"
        showMessages={false}
        showStats={false}
        showStatus
        hasActiveSearch={false}
        hasActiveFilter={false}
      />,
    );
    expect(withoutMessages.lastFrame()).not.toContain('[V]');

    const withMessages = render(
      <HotkeyBar
        paused={false}
        sortDirection="asc"
        showMessages
        showStats={false}
        showStatus
        hasActiveSearch={false}
        hasActiveFilter={false}
      />,
    );
    expect(withMessages.lastFrame()).toContain('[V]');
    expect(withMessages.lastFrame()).toContain('Hide msgs');
  });

  it('labels [F] as Edit filter while a filter is active', () => {
    const { lastFrame } = render(
      <HotkeyBar
        paused={false}
        sortDirection="asc"
        showMessages={false}
        showStats={false}
        showStatus
        hasActiveSearch={false}
        hasActiveFilter
      />,
    );

    expect(lastFrame()).toContain('[F]Edit filter');
  });
});
