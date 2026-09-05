import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { DetailView } from './detail-view.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('DetailView', () => {
  it('shows the ICAO hex in the title and every field label', () => {
    const { lastFrame } = render(
      <DetailView aircraft={makeAircraft()} nowMs={0} location={undefined} />,
    );

    const frame = lastFrame();
    expect(frame).toContain('A0B1C2 detail');
    expect(frame).toContain('Callsign:');
    expect(frame).toContain('Registration:');
    expect(frame).toContain('Position:');
  });

  it('omits Distance/Bearing when no location is configured', () => {
    const { lastFrame } = render(
      <DetailView aircraft={makeAircraft()} nowMs={0} location={undefined} />,
    );

    const frame = lastFrame();
    expect(frame).not.toContain('Distance:');
    expect(frame).not.toContain('Bearing:');
  });

  it('shows Distance/Bearing when a location is configured', () => {
    const aircraft = makeAircraft({ position: { lat: 0, lon: 1 } });
    const { lastFrame } = render(
      <DetailView aircraft={aircraft} nowMs={0} location={{ lat: 0, lon: 0 }} />,
    );

    const frame = lastFrame();
    expect(frame).toContain('Distance:');
    expect(frame).toContain('Bearing:');
  });
});
