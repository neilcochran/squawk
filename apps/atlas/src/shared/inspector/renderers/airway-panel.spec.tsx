import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Airway } from '@squawk/types';

import { AirwayPanel } from './airway-panel.tsx';

const { setHoveredAirwayWaypointIndexMock, canHoverMock } = vi.hoisted(() => ({
  setHoveredAirwayWaypointIndexMock: vi.fn<(index: number | undefined) => void>(),
  canHoverMock: vi.fn<() => boolean>(),
}));

vi.mock('../../../modes/chart/highlight-context.ts', () => ({
  useSetHoveredAirwayWaypointIndex: () => setHoveredAirwayWaypointIndexMock,
}));

vi.mock('../../styles/use-can-hover.ts', () => ({
  useCanHover: canHoverMock,
}));

/** Builds an airway record with N synthetic waypoints for hover testing. */
function buildAirway(waypointCount: number): Airway {
  const waypoints = Array.from({ length: waypointCount }, (_, i) => ({
    name: `WP${i}`,
    identifier: `WP${i}`,
    waypointType: 'WAYPOINT' as const,
    lat: 40 + i,
    lon: -100 + i,
  }));
  return {
    designation: 'V16',
    type: 'VICTOR',
    region: 'US',
    waypoints,
  };
}

describe('AirwayPanel', () => {
  beforeEach(() => {
    setHoveredAirwayWaypointIndexMock.mockClear();
    canHoverMock.mockReturnValue(true);
  });

  it('renders one row per waypoint with the waypoint identifier as the label', () => {
    render(<AirwayPanel record={buildAirway(3)} />);
    expect(screen.getByText('WP0')).toBeInTheDocument();
    expect(screen.getByText('WP1')).toBeInTheDocument();
    expect(screen.getByText('WP2')).toBeInTheDocument();
  });

  it('reports the hovered waypoint index on per-row pointer enter / leave', () => {
    // Row at waypoint index 1 (the second row). Hovering it should
    // set waypoint index 1; leaving should clear.
    render(<AirwayPanel record={buildAirway(3)} />);
    const row = screen.getByText('WP1').closest('div');
    expect(row).not.toBeNull();
    if (row === null) {
      return;
    }
    fireEvent.pointerEnter(row);
    expect(setHoveredAirwayWaypointIndexMock).toHaveBeenCalledWith(1);
    fireEvent.pointerLeave(row);
    expect(setHoveredAirwayWaypointIndexMock).toHaveBeenLastCalledWith(undefined);
  });

  it('reports the row position as the waypoint index for any row', () => {
    // The row at waypoint index N fires N (not N-1) so the focus
    // layer can light up the dot AND the leg ending at that
    // waypoint.
    render(<AirwayPanel record={buildAirway(5)} />);
    const lastRow = screen.getByText('WP4').closest('div');
    expect(lastRow).not.toBeNull();
    if (lastRow === null) {
      return;
    }
    fireEvent.pointerEnter(lastRow);
    expect(setHoveredAirwayWaypointIndexMock).toHaveBeenLastCalledWith(4);
  });

  it('fires the hover handler for the first waypoint row (waypoint index 0)', () => {
    // The first waypoint is the route's starting point - it has no
    // incoming leg, but it IS a fix / navaid / airport in its own
    // right and the user wants the same hover-highlight affordance
    // as every other row. Setting waypoint index 0 lights up just
    // the dot (no leg) since the focus-layer's leg filter excludes
    // index 0.
    render(<AirwayPanel record={buildAirway(3)} />);
    const firstRow = screen.getByText('WP0').closest('div');
    expect(firstRow).not.toBeNull();
    if (firstRow === null) {
      return;
    }
    fireEvent.pointerEnter(firstRow);
    expect(setHoveredAirwayWaypointIndexMock).toHaveBeenCalledWith(0);
    fireEvent.pointerLeave(firstRow);
    expect(setHoveredAirwayWaypointIndexMock).toHaveBeenLastCalledWith(undefined);
  });

  it('does not attach the hover handler on touch devices (canHover false)', () => {
    // Mobile / touch users have `(hover: hover)` resolve false, so
    // synthesized mouseenter from a tap should never fire the
    // highlight - which would otherwise yank the camera around on
    // every list-row tap.
    canHoverMock.mockReturnValue(false);
    render(<AirwayPanel record={buildAirway(3)} />);
    const row = screen.getByText('WP1').closest('div');
    expect(row).not.toBeNull();
    if (row === null) {
      return;
    }
    fireEvent.pointerEnter(row);
    expect(setHoveredAirwayWaypointIndexMock).not.toHaveBeenCalled();
  });

  it('clears the hovered waypoint index on unmount as a defensive cleanup', () => {
    const { unmount } = render(<AirwayPanel record={buildAirway(3)} />);
    setHoveredAirwayWaypointIndexMock.mockClear();
    unmount();
    expect(setHoveredAirwayWaypointIndexMock).toHaveBeenCalledWith(undefined);
  });

  it('does not render the Route section when the airway has no waypoints', () => {
    render(<AirwayPanel record={buildAirway(0)} />);
    expect(screen.queryByText('Route')).toBeNull();
  });

  it('falls back to the waypoint name when the identifier is undefined', () => {
    // Waypoints sourced from CIFP-style tables sometimes lack a short
    // identifier; the panel must still label the row using the long name.
    const record: Airway = {
      designation: 'V16',
      type: 'VICTOR',
      region: 'US',
      waypoints: [{ name: 'BORDER POINT NORTH', waypointType: 'BORDER', lat: 40, lon: -100 }],
    };
    render(<AirwayPanel record={record} />);
    expect(screen.getByText('BORDER POINT NORTH')).toBeInTheDocument();
  });
});
