import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { HelpOverlay } from './help-overlay.js';

describe('HelpOverlay', () => {
  it('describes every hotkey', () => {
    const { lastFrame } = render(<HelpOverlay />);

    const frame = lastFrame();
    expect(frame).toContain('adsbtop help');
    expect(frame).toContain('[O]');
    expect(frame).toContain('Cycle sort column');
    expect(frame).toContain('[Q]');
    expect(frame).toContain('Quit adsbtop');
  });

  it('describes the phase 2 hotkeys: search, messages, verbosity, and detail', () => {
    const frame = render(<HelpOverlay />).lastFrame();

    expect(frame).toContain('Search by ICAO hex, callsign, squawk, or N-number');
    expect(frame).toContain('Jump to the next/previous search match');
    expect(frame).toContain('Toggle the messages panel');
    expect(frame).toContain('Toggle messages panel verbosity');
    expect(frame).toContain("Show the cursor row's full detail view");
  });
});
