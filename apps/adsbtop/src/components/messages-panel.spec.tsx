import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import type { MessageLogEntry } from '../aircraft-state.js';

import { MessagesPanel } from './messages-panel.js';

function makeEntry(overrides: Partial<MessageLogEntry> = {}): MessageLogEntry {
  return { id: 0, type: 'new', icaoHex: 'A0B1C2', callsign: undefined, at: 0, ...overrides };
}

describe('MessagesPanel', () => {
  it('shows a placeholder when there are no messages yet', () => {
    const { lastFrame } = render(<MessagesPanel entries={[]} verbosity="all" />);
    expect(lastFrame()).toContain('No messages yet.');
  });

  it('renders each entry on its own line', () => {
    const entries = [
      makeEntry({ id: 0, icaoHex: 'A0B1C2', callsign: 'UAL123' }),
      makeEntry({ id: 1, icaoHex: 'D3E4F5', callsign: 'DAL456', type: 'lost' }),
    ];
    const { lastFrame } = render(<MessagesPanel entries={entries} verbosity="all" />);

    const frame = lastFrame();
    expect(frame).toContain('A0B1C2');
    expect(frame).toContain('UAL123');
    expect(frame).toContain('D3E4F5');
    expect(frame).toContain('DAL456');
  });

  it('filters out update events when verbosity is newAndLost', () => {
    const entries = [
      makeEntry({ id: 0, icaoHex: 'A0B1C2', type: 'new' }),
      makeEntry({ id: 1, icaoHex: 'D3E4F5', type: 'update' }),
      makeEntry({ id: 2, icaoHex: 'F6A7B8', type: 'lost' }),
    ];
    const { lastFrame } = render(<MessagesPanel entries={entries} verbosity="newAndLost" />);

    const frame = lastFrame();
    expect(frame).toContain('A0B1C2');
    expect(frame).not.toContain('D3E4F5');
    expect(frame).toContain('F6A7B8');
  });

  it('shows update events when verbosity is all', () => {
    const entries = [makeEntry({ id: 0, icaoHex: 'D3E4F5', type: 'update' })];
    const { lastFrame } = render(<MessagesPanel entries={entries} verbosity="all" />);

    expect(lastFrame()).toContain('D3E4F5');
  });

  it('only shows the most recent entries once the log exceeds the visible row count', () => {
    const entries = Array.from({ length: 20 }, (_, index) =>
      makeEntry({ id: index, icaoHex: `HEX${index.toString().padStart(2, '0')}` }),
    );
    const { lastFrame } = render(<MessagesPanel entries={entries} verbosity="all" />);

    const frame = lastFrame();
    expect(frame).not.toContain('HEX00');
    expect(frame).toContain('HEX19');
  });
});
