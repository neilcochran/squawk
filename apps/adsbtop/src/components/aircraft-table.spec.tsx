import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { visibleColumns } from '../columns.js';

import { AircraftTable } from './aircraft-table.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('AircraftTable', () => {
  it('renders column headers', () => {
    const { lastFrame } = render(
      <AircraftTable
        aircraft={[]}
        columns={visibleColumns(false)}
        nowMs={0}
        sortKey="icaoHex"
        selectedIcaoHex={undefined}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('ICAO');
    expect(frame).toContain('Callsign');
    expect(frame).toContain('Alt');
  });

  it('shows a placeholder message when no aircraft are tracked', () => {
    const { lastFrame } = render(
      <AircraftTable
        aircraft={[]}
        columns={visibleColumns(false)}
        nowMs={0}
        sortKey="icaoHex"
        selectedIcaoHex={undefined}
      />,
    );

    expect(lastFrame()).toContain('No aircraft tracked yet.');
  });

  it('renders one row per tracked aircraft', () => {
    const aircraft = [
      makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123' }),
      makeAircraft({ icaoHex: 'D3E4F5', callsign: 'DAL456' }),
    ];
    const { lastFrame } = render(
      <AircraftTable
        aircraft={aircraft}
        columns={visibleColumns(false)}
        nowMs={0}
        sortKey="icaoHex"
        selectedIcaoHex={undefined}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('A0B1C2');
    expect(frame).toContain('UAL123');
    expect(frame).toContain('D3E4F5');
    expect(frame).toContain('DAL456');
  });

  it('renders only the compact columns when given a compact column set', () => {
    const { lastFrame } = render(
      <AircraftTable
        aircraft={[]}
        columns={visibleColumns(true)}
        nowMs={0}
        sortKey="icaoHex"
        selectedIcaoHex={undefined}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('ICAO');
    expect(frame).not.toContain('Grnd');
  });

  it('renders an emergency-squawking aircraft callsign in the output', () => {
    const aircraft = [makeAircraft({ callsign: 'UAL911', squawk: '7700' })];
    const { lastFrame } = render(
      <AircraftTable
        aircraft={aircraft}
        columns={visibleColumns(false)}
        nowMs={0}
        sortKey="icaoHex"
        selectedIcaoHex={undefined}
      />,
    );

    expect(lastFrame()).toContain('UAL911');
  });

  it('renders a declared-emergency-state aircraft callsign in the output', () => {
    const aircraft = [makeAircraft({ callsign: 'DAL456', emergencyState: 'minimumFuel' })];
    const { lastFrame } = render(
      <AircraftTable
        aircraft={aircraft}
        columns={visibleColumns(false)}
        nowMs={0}
        sortKey="icaoHex"
        selectedIcaoHex={undefined}
      />,
    );

    expect(lastFrame()).toContain('DAL456');
  });

  it('renders an active-resolution-advisory aircraft callsign in the output', () => {
    const aircraft = [
      makeAircraft({
        callsign: 'SWA202',
        resolutionAdvisory: {
          active: true,
          advisoryType: 'climb',
          corrective: true,
          downwardSense: false,
          increasedRate: false,
          senseReversal: false,
          altitudeCrossing: false,
          positive: true,
          doNotPassBelow: false,
          doNotPassAbove: false,
          doNotTurnLeft: false,
          doNotTurnRight: false,
          terminated: false,
          multipleThreat: false,
          threat: { threatType: 'none' },
        },
      }),
    ];
    const { lastFrame } = render(
      <AircraftTable
        aircraft={aircraft}
        columns={visibleColumns(false)}
        nowMs={0}
        sortKey="icaoHex"
        selectedIcaoHex={undefined}
      />,
    );

    expect(lastFrame()).toContain('SWA202');
  });

  it('renders every header regardless of which column is the active sort key', () => {
    // ink-testing-library strips ANSI codes from lastFrame(), so the color
    // highlight itself isn't assertable here - this covers that switching
    // sortKey doesn't drop or duplicate a header, which is the part that
    // could actually regress.
    for (const sortKey of ['icaoHex', 'callsign', 'altitude', 'groundSpeed', 'age'] as const) {
      const { lastFrame } = render(
        <AircraftTable
          aircraft={[]}
          columns={visibleColumns(false)}
          nowMs={0}
          sortKey={sortKey}
          selectedIcaoHex={undefined}
        />,
      );
      const frame = lastFrame();
      expect(frame).toContain('ICAO');
      expect(frame).toContain('Callsign');
      expect(frame).toContain('Squawk');
      expect(frame).toContain('Alt');
      expect(frame).toContain('Age');
    }
  });

  it('renders every row regardless of which one is selected', () => {
    // Same ANSI-stripping limitation as the sort-key test above: the cursor
    // row's cyan background isn't assertable here, so this covers that
    // selecting a row doesn't drop content, including for an icaoHex not
    // currently present in `aircraft`.
    const aircraft = [
      makeAircraft({ icaoHex: 'A0B1C2', callsign: 'UAL123' }),
      makeAircraft({ icaoHex: 'D3E4F5', callsign: 'DAL456' }),
    ];
    for (const selectedIcaoHex of ['A0B1C2', 'D3E4F5', 'FFFFFF', undefined]) {
      const { lastFrame } = render(
        <AircraftTable
          aircraft={aircraft}
          columns={visibleColumns(false)}
          nowMs={0}
          sortKey="icaoHex"
          selectedIcaoHex={selectedIcaoHex}
        />,
      );
      const frame = lastFrame();
      expect(frame).toContain('UAL123');
      expect(frame).toContain('DAL456');
    }
  });
});
