import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { availableColumns, COLUMNS } from '../columns.js';

import { ColumnPicker } from './column-picker.js';

const WITHOUT_LOCATION = availableColumns(undefined);
const LOCATION_GATED = COLUMNS.filter((column) => column.requiresLocation);

describe('ColumnPicker', () => {
  it('lists every available column with its short header and full name', () => {
    const { lastFrame } = render(
      <ColumnPicker
        availableColumns={WITHOUT_LOCATION}
        unavailableColumns={[]}
        selectedKeys={WITHOUT_LOCATION.map((column) => column.key)}
        cursorIndex={0}
        autoFit={true}
        terminalWidth={120}
        tableWidth={98}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('adsbtop columns');
    expect(frame).toContain('Hdg');
    expect(frame).toContain('Heading (true track)');
    expect(frame).toContain('VS');
    expect(frame).toContain('Vertical speed');
    expect(frame).toContain('Time since last update');
  });

  it('checks selected columns and leaves the rest unchecked', () => {
    const { lastFrame } = render(
      <ColumnPicker
        availableColumns={WITHOUT_LOCATION}
        unavailableColumns={[]}
        selectedKeys={['icaoHex', 'callsign']}
        cursorIndex={0}
        autoFit={false}
        terminalWidth={120}
        tableWidth={19}
      />,
    );

    const frame = lastFrame() ?? '';
    expect(frame).toMatch(/\[x\] ICAO/);
    expect(frame).toMatch(/\[x\] Callsign/);
    expect(frame).toMatch(/\[ \] Reg/);
    expect(frame).toMatch(/\[ \] Grnd/);
  });

  it('summarizes an auto-fitted selection against the terminal width', () => {
    const { lastFrame } = render(
      <ColumnPicker
        availableColumns={WITHOUT_LOCATION}
        unavailableColumns={[]}
        selectedKeys={['icaoHex', 'callsign', 'squawk', 'altitude', 'age']}
        cursorIndex={0}
        autoFit={true}
        terminalWidth={60}
        tableWidth={53}
      />,
    );

    expect(lastFrame()).toContain('Auto-fit on: showing 5 of 10 columns (table 53 of 60 wide)');
  });

  it('summarizes a custom selection and warns when it overflows the terminal', () => {
    const { lastFrame } = render(
      <ColumnPicker
        availableColumns={WITHOUT_LOCATION}
        unavailableColumns={[]}
        selectedKeys={WITHOUT_LOCATION.map((column) => column.key)}
        cursorIndex={0}
        autoFit={false}
        terminalWidth={80}
        tableWidth={98}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('Custom selection: 10 of 10 columns (table 98 of 80 wide)');
    expect(frame).toContain('wider than the terminal');
  });

  it('lists location-gated columns dimmed with a hint when unavailable', () => {
    const { lastFrame } = render(
      <ColumnPicker
        availableColumns={WITHOUT_LOCATION}
        unavailableColumns={LOCATION_GATED}
        selectedKeys={['icaoHex']}
        cursorIndex={0}
        autoFit={false}
        terminalWidth={120}
        tableWidth={10}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('Closest point of approach (needs --lat/--lon)');
    expect(frame).toContain('Bearing from receiver (needs --lat/--lon)');
  });

  it('shows the picker key legend', () => {
    const { lastFrame } = render(
      <ColumnPicker
        availableColumns={WITHOUT_LOCATION}
        unavailableColumns={[]}
        selectedKeys={['icaoHex']}
        cursorIndex={0}
        autoFit={false}
        terminalWidth={120}
        tableWidth={10}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain('[Space]Toggle');
    expect(frame).toContain('[A]All');
    expect(frame).toContain('[M]Minimal');
    expect(frame).toContain('[F]Auto-fit');
    expect(frame).toContain('[Esc]Close');
  });
});
