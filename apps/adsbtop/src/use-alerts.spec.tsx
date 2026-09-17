import { Text } from 'ink';
import { render } from 'ink-testing-library';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { useAlerts } from './use-alerts.js';
import type { AlertOptions } from './use-alerts.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

function Probe(options: AlertOptions): ReactElement {
  useAlerts(options);
  return <Text>probe</Text>;
}

function flush(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Renders the probe and returns a `step` that re-renders with new options and settles the effect. */
function harness(initial: Partial<AlertOptions> = {}): {
  ring: ReturnType<typeof vi.fn>;
  step: (overrides: Partial<AlertOptions>) => Promise<void>;
} {
  const ring = vi.fn();
  const base: AlertOptions = {
    aircraft: [],
    watchlist: [],
    alertEmergency: false,
    enabled: true,
    ring,
    ...initial,
  };
  const { rerender } = render(<Probe {...base} />);
  let current = base;
  return {
    ring,
    step: async (overrides) => {
      current = { ...current, ...overrides };
      rerender(<Probe {...current} />);
      await flush();
    },
  };
}

describe('useAlerts', () => {
  it('rings when a watched aircraft appears, by hex, callsign prefix, or N-number', async () => {
    const { ring, step } = harness({ watchlist: ['A0B1C2', 'UAL', 'N12345'] });
    await flush();
    expect(ring).not.toHaveBeenCalled();

    await step({ aircraft: [makeAircraft({ icaoHex: 'A0B1C2' })] });
    expect(ring).toHaveBeenCalledTimes(1);

    await step({
      aircraft: [
        makeAircraft({ icaoHex: 'A0B1C2' }),
        makeAircraft({ icaoHex: 'B00000', callsign: 'UAL9' }),
      ],
    });
    expect(ring).toHaveBeenCalledTimes(2);

    await step({
      aircraft: [
        makeAircraft({ icaoHex: 'A0B1C2' }),
        makeAircraft({ icaoHex: 'B00000', callsign: 'UAL9' }),
        makeAircraft({
          icaoHex: 'C00000',
          registration: { icaoHex: 'C00000', registration: 'N12345' },
        }),
      ],
    });
    expect(ring).toHaveBeenCalledTimes(3);
  });

  it('rings when a watched aircraft is lost', async () => {
    const { ring, step } = harness({ watchlist: ['A0B1C2'] });
    await step({ aircraft: [makeAircraft({ icaoHex: 'A0B1C2' })] });
    expect(ring).toHaveBeenCalledTimes(1);

    await step({ aircraft: [] });
    expect(ring).toHaveBeenCalledTimes(2);
  });

  it('rings when a tracked aircraft becomes watched as its registration resolves', async () => {
    const { ring, step } = harness({ watchlist: ['N12345'] });
    await step({ aircraft: [makeAircraft()] });
    expect(ring).not.toHaveBeenCalled();

    await step({
      aircraft: [makeAircraft({ registration: { icaoHex: 'A0B1C2', registration: 'N12345' } })],
    });
    expect(ring).toHaveBeenCalledTimes(1);
  });

  it('does not ring for unwatched aircraft or for updates to an already-watched one', async () => {
    const { ring, step } = harness({ watchlist: ['UAL'] });
    await step({ aircraft: [makeAircraft({ callsign: 'DAL1' })] });
    expect(ring).not.toHaveBeenCalled();

    await step({
      aircraft: [
        makeAircraft({ callsign: 'DAL1' }),
        makeAircraft({ icaoHex: 'B00000', callsign: 'UAL1' }),
      ],
    });
    expect(ring).toHaveBeenCalledTimes(1);

    await step({
      aircraft: [
        makeAircraft({ callsign: 'DAL1' }),
        makeAircraft({ icaoHex: 'B00000', callsign: 'UAL1', groundSpeedKt: 300 }),
      ],
    });
    expect(ring).toHaveBeenCalledTimes(1);
  });

  it('rings once per update batch even when several watched aircraft change', async () => {
    const { ring, step } = harness({ watchlist: ['UAL'] });
    await step({
      aircraft: [
        makeAircraft({ icaoHex: 'A00000', callsign: 'UAL1' }),
        makeAircraft({ icaoHex: 'B00000', callsign: 'UAL2' }),
      ],
    });
    expect(ring).toHaveBeenCalledTimes(1);
  });

  it('rings when an aircraft becomes an emergency only with alertEmergency', async () => {
    const quiet = harness({ alertEmergency: false });
    await quiet.step({ aircraft: [makeAircraft({ squawk: '7700' })] });
    expect(quiet.ring).not.toHaveBeenCalled();

    const loud = harness({ alertEmergency: true });
    await loud.step({ aircraft: [makeAircraft({ squawk: '1200' })] });
    expect(loud.ring).not.toHaveBeenCalled();
    await loud.step({ aircraft: [makeAircraft({ squawk: '7700' })] });
    expect(loud.ring).toHaveBeenCalledTimes(1);
    await loud.step({ aircraft: [makeAircraft({ squawk: '7700', groundSpeedKt: 200 })] });
    expect(loud.ring).toHaveBeenCalledTimes(1);
  });

  it('does not ring for an emergency that ends', async () => {
    const { ring, step } = harness({ alertEmergency: true });
    await step({ aircraft: [makeAircraft({ squawk: '7700' })] });
    expect(ring).toHaveBeenCalledTimes(1);
    await step({ aircraft: [makeAircraft({ squawk: '1200' })] });
    expect(ring).toHaveBeenCalledTimes(1);
  });

  it('stays silent while disabled and drops changes that happened meanwhile', async () => {
    const { ring, step } = harness({ watchlist: ['A0B1C2'], enabled: false });
    await step({ aircraft: [makeAircraft({ icaoHex: 'A0B1C2' })] });
    expect(ring).not.toHaveBeenCalled();

    await step({ enabled: true });
    expect(ring).not.toHaveBeenCalled();

    await step({ aircraft: [] });
    expect(ring).toHaveBeenCalledTimes(1);
  });
});
