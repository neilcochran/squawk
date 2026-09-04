import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { StatusHeader } from './status-header.js';

describe('StatusHeader', () => {
  it('renders source, host, port, and aircraft count', () => {
    const { lastFrame } = render(
      <StatusHeader
        source="sbs"
        host="192.168.1.50"
        port={30003}
        aircraftCount={5}
        messageRatePerSec={12}
        lastMessageAt={1000}
        nowMs={4000}
        paused={false}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('adsbtop');
    expect(frame).toContain('sbs 192.168.1.50:30003');
    expect(frame).toContain('aircraft: 5');
    expect(frame).not.toContain('PAUSED');
  });

  it('shows a PAUSED indicator when paused', () => {
    const { lastFrame } = render(
      <StatusHeader
        source="beast"
        host="localhost"
        port={30005}
        aircraftCount={0}
        messageRatePerSec={0}
        lastMessageAt={undefined}
        nowMs={0}
        paused
      />,
    );

    expect(lastFrame()).toContain('PAUSED');
  });
});
