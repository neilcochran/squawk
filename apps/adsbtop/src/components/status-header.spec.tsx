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
        filter={undefined}
        watch={undefined}
        recordPath={undefined}
        notice={undefined}
        messageCount={1234}
        messageRatePerSec={12}
        lastMessageAt={1000}
        nowMs={4000}
        paused={false}
        connectionState="connected"
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('adsbtop');
    expect(frame).toContain('sbs 192.168.1.50:30003');
    expect(frame).toContain('aircraft: 5');
    expect(frame).toContain('msgs: 1234');
    expect(frame).not.toContain('PAUSED');
    expect(frame).not.toContain('RECONNECTING');
  });

  it('shows a PAUSED indicator when paused', () => {
    const { lastFrame } = render(
      <StatusHeader
        source="beast"
        host="localhost"
        port={30005}
        aircraftCount={0}
        filter={undefined}
        watch={undefined}
        recordPath={undefined}
        notice={undefined}
        messageCount={0}
        messageRatePerSec={0}
        lastMessageAt={undefined}
        nowMs={0}
        paused
        connectionState="connected"
      />,
    );

    expect(lastFrame()).toContain('PAUSED');
  });

  it('shows a RECONNECTING indicator when the feed is not connected', () => {
    const { lastFrame } = render(
      <StatusHeader
        source="sbs"
        host="192.168.1.50"
        port={30003}
        aircraftCount={0}
        filter={undefined}
        watch={undefined}
        recordPath={undefined}
        notice={undefined}
        messageCount={0}
        messageRatePerSec={0}
        lastMessageAt={undefined}
        nowMs={0}
        paused={false}
        connectionState="reconnecting"
      />,
    );

    expect(lastFrame()).toContain('RECONNECTING');
  });

  it('shows a notice chip when one is set', () => {
    const { lastFrame } = render(
      <StatusHeader
        source="sbs"
        host="192.168.1.50"
        port={30003}
        aircraftCount={0}
        filter={undefined}
        watch={undefined}
        recordPath="f.jsonl"
        notice={{ text: 'saved adsbtop-20260916-090507.csv', kind: 'ok' }}
        messageCount={0}
        messageRatePerSec={0}
        lastMessageAt={undefined}
        nowMs={0}
        paused={false}
        connectionState="connected"
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('rec: f.jsonl');
    expect(frame).toContain('saved adsbtop-20260916-090507.csv');
  });
});
