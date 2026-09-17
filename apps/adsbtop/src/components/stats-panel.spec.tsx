import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { StatsPanel } from './stats-panel.js';

describe('StatsPanel', () => {
  it('renders the title and every stats line', () => {
    const { lastFrame } = render(
      <StatsPanel
        startedAt={0}
        nowMs={65_000}
        aircraftCount={12}
        peakAircraftCount={23}
        uniqueAircraftCount={87}
        messageCount={4064}
        messageRatePerSec={45}
        rateHistory={[30, 40, 61]}
        maxDistance={{ icaoHex: 'A0B1C2', callsign: 'UAL123', distanceNm: 212 }}
        hasLocation
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('Session stats');
    expect(frame).toContain('up 1m05s  |  aircraft: 12 now, peak 23, 87 unique');
    expect(frame).toContain('msgs: 4064 total  |  45/s now, 44/s avg, 61/s peak over last 3s');
    expect(frame).toContain('max distance: 212nm (A0B1C2 UAL123)');
    expect(frame).toContain('msgs/s: ');
  });

  it('omits the distance line without a location', () => {
    const { lastFrame } = render(
      <StatsPanel
        startedAt={0}
        nowMs={0}
        aircraftCount={0}
        peakAircraftCount={0}
        uniqueAircraftCount={0}
        messageCount={0}
        messageRatePerSec={0}
        rateHistory={[]}
        maxDistance={undefined}
        hasLocation={false}
      />,
    );

    expect(lastFrame()).not.toContain('max distance');
    expect(lastFrame()).toContain('no rate samples yet');
  });
});
