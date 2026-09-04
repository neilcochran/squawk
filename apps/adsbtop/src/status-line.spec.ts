import { describe, expect, it } from 'vitest';

import { formatStatusLine } from './status-line.js';
import type { StatusLineInfo } from './status-line.js';

function makeInfo(overrides: Partial<StatusLineInfo> = {}): StatusLineInfo {
  return {
    source: 'sbs',
    host: '192.168.1.50',
    port: 30003,
    aircraftCount: 0,
    messageRatePerSec: 0,
    lastMessageAt: undefined,
    nowMs: 0,
    ...overrides,
  };
}

describe('formatStatusLine', () => {
  it('includes the source, host, port, aircraft count, and message rate', () => {
    const line = formatStatusLine(makeInfo({ aircraftCount: 5, messageRatePerSec: 12 }));

    expect(line).toContain('source: sbs 192.168.1.50:30003');
    expect(line).toContain('aircraft: 5');
    expect(line).toContain('msgs/s: 12');
  });

  it('shows a placeholder before any update has arrived', () => {
    const line = formatStatusLine(makeInfo({ lastMessageAt: undefined }));

    expect(line).toContain('last update: none yet');
  });

  it('shows an elapsed-time age once an update has arrived', () => {
    const line = formatStatusLine(makeInfo({ lastMessageAt: 1000, nowMs: 4000 }));

    expect(line).toContain('last update: 3s ago');
  });
});
