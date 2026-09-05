import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import type { PositionHistoryEntry } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import { DetailView } from './detail-view.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('DetailView', () => {
  it('shows the ICAO hex in the title and every field label', () => {
    const { lastFrame } = render(
      <DetailView aircraft={makeAircraft()} positionHistory={[]} nowMs={0} />,
    );

    const frame = lastFrame();
    expect(frame).toContain('A0B1C2 detail');
    expect(frame).toContain('Callsign:');
    expect(frame).toContain('Registration:');
    expect(frame).toContain('Position:');
  });

  it('shows a placeholder when there is no position history', () => {
    const { lastFrame } = render(
      <DetailView aircraft={makeAircraft()} positionHistory={[]} nowMs={0} />,
    );

    expect(lastFrame()).toContain('No altitude history yet.');
  });

  it('renders an altitude sparkline when position history is available', () => {
    const positionHistory: PositionHistoryEntry[] = [
      { position: { lat: 0, lon: 0, baroAltitudeFt: 1000 }, recordedAt: 0 },
      { position: { lat: 0, lon: 0, baroAltitudeFt: 5000 }, recordedAt: 1000 },
    ];
    const { lastFrame } = render(
      <DetailView aircraft={makeAircraft()} positionHistory={positionHistory} nowMs={0} />,
    );

    expect(lastFrame()).not.toContain('No altitude history yet.');
    expect(lastFrame()).toContain('Altitude history:');
  });
});
