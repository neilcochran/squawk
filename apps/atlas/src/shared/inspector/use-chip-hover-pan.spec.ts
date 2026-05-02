/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  INSPECTOR_OVERLAY_DESKTOP_WIDTH_PX,
  isPointOutsideComfortableArea,
  panToFeatureWithInspectorOffset,
  restoreCenter,
  getMapInstance,
} from './use-chip-hover-pan.ts';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { MapRef } from '@vis.gl/react-maplibre';

interface FakeCanvas {
  clientWidth: number;
  clientHeight: number;
}

interface FakeMap {
  project: (lngLat: [number, number]) => { x: number; y: number };
  getCanvas: () => FakeCanvas;
  easeTo: ReturnType<typeof vi.fn>;
}

function buildFakeMap(
  canvasWidth: number,
  canvasHeight: number,
  projectFn?: (lngLat: [number, number]) => { x: number; y: number },
): FakeMap {
  return {
    project: projectFn ?? (() => ({ x: 100, y: 100 })),
    getCanvas: () => ({ clientWidth: canvasWidth, clientHeight: canvasHeight }),
    easeTo: vi.fn(),
  };
}

const originalInnerWidth = window.innerWidth;

beforeEach(() => {
  // Default to desktop breakpoint so the inspector occludes the right edge.
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 1024,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: originalInnerWidth,
  });
  vi.restoreAllMocks();
});

describe('INSPECTOR_OVERLAY_DESKTOP_WIDTH_PX', () => {
  it('matches the documented 360 px width', () => {
    expect(INSPECTOR_OVERLAY_DESKTOP_WIDTH_PX).toBe(360);
  });
});

describe('isPointOutsideComfortableArea (desktop)', () => {
  it('returns false for a point comfortably inside the visible canvas', () => {
    const map = buildFakeMap(1024, 768, () => ({ x: 100, y: 100 }));
    const result = isPointOutsideComfortableArea({ lng: 0, lat: 0 }, map as unknown as MaplibreMap);
    expect(result).toBe(false);
  });

  it('returns true when the point is past the right-edge inspector occlusion', () => {
    const map = buildFakeMap(1024, 768, () => ({ x: 1000, y: 100 }));
    const result = isPointOutsideComfortableArea({ lng: 0, lat: 0 }, map as unknown as MaplibreMap);
    expect(result).toBe(true);
  });

  it('returns true when the point is too close to the left edge', () => {
    const map = buildFakeMap(1024, 768, () => ({ x: 5, y: 100 }));
    const result = isPointOutsideComfortableArea({ lng: 0, lat: 0 }, map as unknown as MaplibreMap);
    expect(result).toBe(true);
  });

  it('returns true when the point is too close to the top edge', () => {
    const map = buildFakeMap(1024, 768, () => ({ x: 100, y: 5 }));
    const result = isPointOutsideComfortableArea({ lng: 0, lat: 0 }, map as unknown as MaplibreMap);
    expect(result).toBe(true);
  });

  it('returns true when the point is too close to the bottom edge', () => {
    const map = buildFakeMap(1024, 768, () => ({ x: 100, y: 760 }));
    const result = isPointOutsideComfortableArea({ lng: 0, lat: 0 }, map as unknown as MaplibreMap);
    expect(result).toBe(true);
  });
});

describe('isPointOutsideComfortableArea (mobile)', () => {
  it('detects bottom-sheet occlusion below the mobile breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 600, // below 768 desktop breakpoint
    });
    // Point near the bottom of the canvas; bottom 60% is occluded by the sheet.
    const map = buildFakeMap(600, 1000, () => ({ x: 300, y: 500 }));
    const result = isPointOutsideComfortableArea({ lng: 0, lat: 0 }, map as unknown as MaplibreMap);
    expect(result).toBe(true);
  });
});

describe('panToFeatureWithInspectorOffset', () => {
  it('eases to the target with negative-x offset on desktop', () => {
    const map = buildFakeMap(1024, 768);
    panToFeatureWithInspectorOffset({ lng: -73, lat: 40 }, map as unknown as MaplibreMap);
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    const args = map.easeTo.mock.calls[0]?.[0];
    expect(args.center).toEqual([-73, 40]);
    // On desktop the right-edge occlusion shifts the focal point left.
    expect(args.offset[0]).toBeLessThan(0);
    expect(args.offset[1]).toBe(0);
  });

  it('eases to the target with negative-y offset on mobile', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 600,
    });
    const map = buildFakeMap(600, 1000);
    panToFeatureWithInspectorOffset({ lng: -73, lat: 40 }, map as unknown as MaplibreMap);
    const args = map.easeTo.mock.calls[0]?.[0];
    expect(args.offset[0]).toBe(0);
    expect(args.offset[1]).toBeLessThan(0);
  });
});

describe('restoreCenter', () => {
  it('eases to the captured center without an offset', () => {
    const map = buildFakeMap(1024, 768);
    restoreCenter({ lng: -73, lat: 40 }, map as unknown as MaplibreMap);
    const args = map.easeTo.mock.calls[0]?.[0];
    expect(args.center).toEqual([-73, 40]);
    expect(args.offset).toBeUndefined();
  });
});

describe('getMapInstance', () => {
  it('returns undefined when the mapRef is undefined', () => {
    expect(getMapInstance(undefined)).toBeUndefined();
  });

  it('returns undefined when the mapRef getMap returns undefined', () => {
    const ref = { getMap: () => undefined } as unknown as MapRef;
    expect(getMapInstance(ref)).toBeUndefined();
  });

  it('returns the underlying MaplibreMap when present', () => {
    const fakeMap = buildFakeMap(1024, 768);
    const ref = { getMap: () => fakeMap as unknown as MaplibreMap } as unknown as MapRef;
    expect(getMapInstance(ref)).toBe(fakeMap);
  });
});
