import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MapRef } from '@vis.gl/react-maplibre';
import type { Airway } from '@squawk/types';
import { useAirwayLegHoverPan } from './use-airway-leg-hover-pan.ts';
import type { ResolvedEntityState } from './entity-resolver.ts';

const {
  getMapInstanceMock,
  isPointOutsideComfortableAreaMock,
  panToFeatureWithInspectorOffsetMock,
  restoreCenterMock,
} = vi.hoisted(() => ({
  getMapInstanceMock: vi.fn(),
  isPointOutsideComfortableAreaMock: vi.fn<() => boolean>(),
  panToFeatureWithInspectorOffsetMock: vi.fn(),
  restoreCenterMock: vi.fn(),
}));

vi.mock('./use-chip-hover-pan.ts', () => ({
  getMapInstance: getMapInstanceMock,
  isPointOutsideComfortableArea: isPointOutsideComfortableAreaMock,
  panToFeatureWithInspectorOffset: panToFeatureWithInspectorOffsetMock,
  restoreCenter: restoreCenterMock,
}));

/** Builds a minimal airway entity state with N waypoints starting at (40, -100). */
function airwayState(waypointCount: number): ResolvedEntityState {
  const waypoints = Array.from({ length: waypointCount }, (_, i) => ({
    name: `WP${i}`,
    identifier: `WP${i}`,
    waypointType: 'WAYPOINT' as const,
    lat: 40 + i,
    lon: -100 + i,
  }));
  const record: Airway = { designation: 'V16', type: 'VICTOR', region: 'US', waypoints };
  return { status: 'resolved', entity: { kind: 'airway', record } };
}

/**
 * Returns a stub Map ref where `getCenter` returns `pre-pan-center`,
 * `on` and `off` are no-ops, and the helper hooks above are pre-wired
 * via the module mock. Tests mutate `isPointOutsideComfortableAreaMock`
 * per-case to drive the comfort gate.
 */
function makeMapRef(): { ref: MapRef; map: { getCenter: () => { lng: number; lat: number } } } {
  const map = {
    getCenter: vi.fn().mockReturnValue({ lng: -50, lat: 50 }),
    on: vi.fn(),
    off: vi.fn(),
  };
  return {
    ref: { getMap: () => map } as unknown as MapRef,
    map,
  };
}

describe('useAirwayLegHoverPan', () => {
  beforeEach(() => {
    getMapInstanceMock.mockReset();
    isPointOutsideComfortableAreaMock.mockReset();
    panToFeatureWithInspectorOffsetMock.mockReset();
    restoreCenterMock.mockReset();
  });

  it('eases the camera to the leg midpoint when a non-first waypoint row is hovered', () => {
    // Hovering waypoint index 1 (the second row) targets the leg
    // ending at WP1 - midpoint of WP0 [-100, 40] and WP1 [-99, 41]
    // = (-99.5, 40.5). The comfort gate reports "outside" so the
    // pre-pan center is captured for later restore.
    const { ref, map } = makeMapRef();
    getMapInstanceMock.mockReturnValue(map);
    isPointOutsideComfortableAreaMock.mockReturnValue(true);
    renderHook(() =>
      useAirwayLegHoverPan({
        selected: 'airway:V16',
        hoveredWaypointIndex: 1,
        state: airwayState(3),
        mapRef: ref,
      }),
    );
    expect(panToFeatureWithInspectorOffsetMock).toHaveBeenCalledTimes(1);
    expect(panToFeatureWithInspectorOffsetMock).toHaveBeenCalledWith(
      { lng: -99.5, lat: 40.5 },
      map,
    );
    expect(map.getCenter).toHaveBeenCalled();
  });

  it('eases the camera to the start waypoint itself when row 0 is hovered', () => {
    // Hovering the first row (waypoint index 0) has no incoming leg,
    // so the pan target is the waypoint's own coordinates - WP0 sits
    // at [-100, 40], and that's exactly where the camera lands.
    const { ref, map } = makeMapRef();
    getMapInstanceMock.mockReturnValue(map);
    isPointOutsideComfortableAreaMock.mockReturnValue(true);
    renderHook(() =>
      useAirwayLegHoverPan({
        selected: 'airway:V16',
        hoveredWaypointIndex: 0,
        state: airwayState(3),
        mapRef: ref,
      }),
    );
    expect(panToFeatureWithInspectorOffsetMock).toHaveBeenCalledTimes(1);
    expect(panToFeatureWithInspectorOffsetMock).toHaveBeenCalledWith({ lng: -100, lat: 40 }, map);
  });

  it('skips the pan when the target is already comfortably onscreen', () => {
    // The user's stated intent: only pan if the area is out of view.
    // A target already in the un-occluded portion of the map should
    // not jolt the camera.
    const { ref, map } = makeMapRef();
    getMapInstanceMock.mockReturnValue(map);
    isPointOutsideComfortableAreaMock.mockReturnValue(false);
    renderHook(() =>
      useAirwayLegHoverPan({
        selected: 'airway:V16',
        hoveredWaypointIndex: 1,
        state: airwayState(3),
        mapRef: ref,
      }),
    );
    expect(panToFeatureWithInspectorOffsetMock).not.toHaveBeenCalled();
    expect(restoreCenterMock).not.toHaveBeenCalled();
  });

  it('restores the captured pre-pan center when the row is unhovered', () => {
    // Hover then unhover within one mounted instance: the pre-pan
    // capture from the hover phase drives the restore.
    const { ref, map } = makeMapRef();
    getMapInstanceMock.mockReturnValue(map);
    isPointOutsideComfortableAreaMock.mockReturnValue(true);
    const { rerender } = renderHook(
      ({ index }: { index: number | undefined }) =>
        useAirwayLegHoverPan({
          selected: 'airway:V16',
          hoveredWaypointIndex: index,
          state: airwayState(3),
          mapRef: ref,
        }),
      { initialProps: { index: 1 as number | undefined } },
    );
    expect(panToFeatureWithInspectorOffsetMock).toHaveBeenCalledTimes(1);
    rerender({ index: undefined });
    expect(restoreCenterMock).toHaveBeenCalledTimes(1);
    expect(restoreCenterMock).toHaveBeenCalledWith({ lng: -50, lat: 50 }, map);
  });

  it('does not restore on unhover when no pan ever fired in the session', () => {
    // If the comfort gate kept the camera still on the hover-enter
    // (because the target was already onscreen), the unhover phase
    // has no captured center to restore - leaving the camera where
    // the user left it.
    const { ref, map } = makeMapRef();
    getMapInstanceMock.mockReturnValue(map);
    isPointOutsideComfortableAreaMock.mockReturnValue(false);
    const { rerender } = renderHook(
      ({ index }: { index: number | undefined }) =>
        useAirwayLegHoverPan({
          selected: 'airway:V16',
          hoveredWaypointIndex: index,
          state: airwayState(3),
          mapRef: ref,
        }),
      { initialProps: { index: 1 as number | undefined } },
    );
    rerender({ index: undefined });
    expect(panToFeatureWithInspectorOffsetMock).not.toHaveBeenCalled();
    expect(restoreCenterMock).not.toHaveBeenCalled();
  });

  it('does nothing when the resolved entity is not an airway', () => {
    // The hook is airway-specific: an airport / navaid / fix selection
    // with a stray waypoint index in flight (e.g. URL flips between
    // an airway and another entity) must not try to read `waypoints`.
    // A `not-found` resolution exercises the same early-return path
    // without forcing the test to construct a full Airport record.
    const { ref, map } = makeMapRef();
    getMapInstanceMock.mockReturnValue(map);
    isPointOutsideComfortableAreaMock.mockReturnValue(true);
    const notFoundState: ResolvedEntityState = {
      status: 'not-found',
      ref: { type: 'airway', id: 'V16' },
    };
    renderHook(() =>
      useAirwayLegHoverPan({
        selected: 'airway:V16',
        hoveredWaypointIndex: 0,
        state: notFoundState,
        mapRef: ref,
      }),
    );
    expect(panToFeatureWithInspectorOffsetMock).not.toHaveBeenCalled();
  });

  it('does not pan when a waypoint index references a non-existent waypoint', () => {
    // Defensive: waypoint index 5 in a 3-waypoint airway has no
    // matching coordinate. The hook should bail rather than try to
    // read undefined coordinates.
    const { ref, map } = makeMapRef();
    getMapInstanceMock.mockReturnValue(map);
    isPointOutsideComfortableAreaMock.mockReturnValue(true);
    renderHook(() =>
      useAirwayLegHoverPan({
        selected: 'airway:V16',
        hoveredWaypointIndex: 5,
        state: airwayState(3),
        mapRef: ref,
      }),
    );
    expect(panToFeatureWithInspectorOffsetMock).not.toHaveBeenCalled();
  });

  it('does nothing when the map ref is not yet available', () => {
    // First render before MapLibre initializes: the hook should be
    // inert, not throw on a `.getMap()` of undefined.
    getMapInstanceMock.mockReturnValue(undefined);
    expect(() =>
      renderHook(() =>
        useAirwayLegHoverPan({
          selected: 'airway:V16',
          hoveredWaypointIndex: 1,
          state: airwayState(3),
          mapRef: undefined,
        }),
      ),
    ).not.toThrow();
    expect(panToFeatureWithInspectorOffsetMock).not.toHaveBeenCalled();
  });
});
