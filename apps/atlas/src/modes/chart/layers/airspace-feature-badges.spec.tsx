import { act, render } from '@testing-library/react';
import type { Feature, Polygon } from 'geojson';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AIRSPACE_BADGE_PROJECTION_LAYER_ID,
  AirspaceFeatureBadges,
} from './airspace-feature-badges.tsx';

const {
  useAirspaceDatasetMock,
  useActiveHighlightRefMock,
  useHoveredFeatureIndexMock,
  useMapMock,
} = vi.hoisted(() => ({
  useAirspaceDatasetMock: vi.fn(),
  useActiveHighlightRefMock: vi.fn(),
  useHoveredFeatureIndexMock: vi.fn(),
  useMapMock: vi.fn(),
}));

vi.mock('../../../shared/data/airspace-dataset.ts', () => ({
  useAirspaceDataset: useAirspaceDatasetMock,
}));

vi.mock('../highlight-context.ts', () => ({
  useActiveHighlightRef: useActiveHighlightRefMock,
  useHoveredFeatureIndex: useHoveredFeatureIndexMock,
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  useMap: useMapMock,
}));

// A linear stand-in for MapLibre's mercator conversion: x grows with
// longitude, y shrinks northward, z carries the altitude scaled down.
vi.mock('maplibre-gl', () => ({
  MercatorCoordinate: {
    fromLngLat: (lngLat: [number, number], altitude = 0): { x: number; y: number; z: number } => ({
      x: (lngLat[0] + 180) / 360,
      y: (90 - lngLat[1]) / 180,
      z: altitude / 1_000_000,
    }),
  },
}));

/**
 * Column-major matrix that flips y the way MapLibre's projection does
 * and adds mercator z into clip y, so a lifted point moves up the
 * screen the way a box top does under a tilted camera.
 */
const LIFTING_MATRIX: readonly number[] = [1, 0, 0, 0, 0, -1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];

/** The part of a custom layer the fake map needs: an id and a render callback. */
interface RenderableLayer {
  id: string;
  render: (
    gl: unknown,
    options: { defaultProjectionData: { mainMatrix: readonly number[] } },
  ) => void;
}

function isRenderableLayer(value: unknown): value is RenderableLayer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'render' in value &&
    typeof value.render === 'function'
  );
}

function createFakeMap(options: { pitch?: number; styleLoaded?: boolean } = {}): {
  map: object;
  layers: Map<string, RenderableLayer>;
  handlers: Map<string, () => void>;
  addLayer: ReturnType<typeof vi.fn>;
  removeLayer: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  triggerRepaint: ReturnType<typeof vi.fn>;
  renderFrame: (matrix?: readonly number[]) => void;
  setPitch: (pitch: number) => void;
  loadStyle: () => void;
} {
  let pitch = options.pitch ?? 0;
  let styleLoaded = options.styleLoaded ?? true;
  const layers = new Map<string, RenderableLayer>();
  const handlers = new Map<string, () => void>();
  const addLayer = vi.fn((layer: unknown) => {
    if (isRenderableLayer(layer)) {
      layers.set(layer.id, layer);
    }
  });
  const removeLayer = vi.fn((id: string) => {
    layers.delete(id);
  });
  const off = vi.fn((event: string) => {
    handlers.delete(event);
  });
  const triggerRepaint = vi.fn();
  const map = {
    getZoom: (): number => 8,
    getPitch: (): number => pitch,
    getCanvas: (): { clientWidth: number; clientHeight: number } => ({
      clientWidth: 1000,
      clientHeight: 1000,
    }),
    isStyleLoaded: (): boolean => styleLoaded,
    getLayer: (id: string): { id: string } | undefined => (layers.has(id) ? { id } : undefined),
    addLayer,
    removeLayer,
    on: (event: string, handler: () => void): void => {
      handlers.set(event, handler);
    },
    off,
    triggerRepaint,
  };
  return {
    map,
    layers,
    handlers,
    addLayer,
    removeLayer,
    off,
    triggerRepaint,
    renderFrame: (matrix = LIFTING_MATRIX): void => {
      layers
        .get(AIRSPACE_BADGE_PROJECTION_LAYER_ID)
        ?.render(undefined, { defaultProjectionData: { mainMatrix: matrix } });
    },
    setPitch: (next: number): void => {
      pitch = next;
    },
    loadStyle: (): void => {
      styleLoaded = true;
      handlers.get('styledata')?.();
    },
  };
}

function square(x0: number, y0: number): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [x0, y0],
        [x0 + 1, y0],
        [x0 + 1, y0 + 1],
        [x0, y0 + 1],
        [x0, y0],
      ],
    ],
  };
}

function classBRing(floorFt: number, geometry: Polygon): Feature {
  return {
    type: 'Feature',
    geometry,
    properties: {
      type: 'CLASS_B',
      identifier: 'BOS',
      floor: { valueFt: floorFt, reference: 'MSL' },
      ceiling: { valueFt: 7000, reference: 'MSL' },
    },
  };
}

function loadedDataset(features: Feature[]): { status: 'loaded'; dataset: unknown } {
  return { status: 'loaded', dataset: { features } };
}

/** The badge elements in document order. */
function badgeElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-feature-index]'));
}

function translateX(element: HTMLElement | undefined): number {
  return Number(/translate\(([-\d.]+)px/.exec(element?.style.transform ?? '')?.[1]);
}

function translateY(element: HTMLElement | undefined): number {
  return Number(/translate\([-\d.]+px, ([-\d.]+)px/.exec(element?.style.transform ?? '')?.[1]);
}

describe('AirspaceFeatureBadges', () => {
  beforeEach(() => {
    useHoveredFeatureIndexMock.mockReturnValue(undefined);
    useActiveHighlightRefMock.mockReturnValue({ type: 'airspace', id: 'CLASS_B/BOS' });
    useAirspaceDatasetMock.mockReturnValue(
      loadedDataset([classBRing(1000, square(0, 0)), classBRing(4000, square(10, 10))]),
    );
  });

  it('renders nothing while the dataset is loading', () => {
    useAirspaceDatasetMock.mockReturnValue({ status: 'loading' });
    useMapMock.mockReturnValue({ current: undefined, default: undefined });
    const { container } = render(<AirspaceFeatureBadges />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the active entity is not an airspace', () => {
    useActiveHighlightRefMock.mockReturnValue({ type: 'airport', id: 'BOS' });
    useMapMock.mockReturnValue({ current: undefined, default: undefined });
    const { container } = render(<AirspaceFeatureBadges />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a single-feature airspace', () => {
    useAirspaceDatasetMock.mockReturnValue(loadedDataset([classBRing(1000, square(0, 0))]));
    useMapMock.mockReturnValue({ current: undefined, default: undefined });
    const { container } = render(<AirspaceFeatureBadges />);
    expect(container).toBeEmptyDOMElement();
  });

  it('adds the projection layer, asks for a frame, and removes the layer on unmount', () => {
    const fake = createFakeMap();
    useMapMock.mockReturnValue({ current: { getMap: () => fake.map }, default: undefined });
    const { unmount } = render(<AirspaceFeatureBadges />);
    expect(fake.layers.has(AIRSPACE_BADGE_PROJECTION_LAYER_ID)).toBe(true);
    expect(fake.triggerRepaint).toHaveBeenCalled();
    unmount();
    expect(fake.removeLayer).toHaveBeenCalledWith(AIRSPACE_BADGE_PROJECTION_LAYER_ID);
    expect(fake.off).toHaveBeenCalledWith('styledata', expect.any(Function));
    expect(fake.layers.has(AIRSPACE_BADGE_PROJECTION_LAYER_ID)).toBe(false);
  });

  it('waits for the style to load before adding the layer', () => {
    const fake = createFakeMap({ styleLoaded: false });
    useMapMock.mockReturnValue({ current: undefined, default: { getMap: () => fake.map } });
    render(<AirspaceFeatureBadges />);
    expect(fake.addLayer).not.toHaveBeenCalled();
    act(() => {
      fake.loadStyle();
    });
    expect(fake.layers.has(AIRSPACE_BADGE_PROJECTION_LAYER_ID)).toBe(true);
  });

  it('re-adds the layer after a style reload drops it', () => {
    const fake = createFakeMap();
    useMapMock.mockReturnValue({ current: { getMap: () => fake.map }, default: undefined });
    render(<AirspaceFeatureBadges />);
    fake.layers.delete(AIRSPACE_BADGE_PROJECTION_LAYER_ID);
    act(() => {
      fake.handlers.get('styledata')?.();
    });
    expect(fake.layers.has(AIRSPACE_BADGE_PROJECTION_LAYER_ID)).toBe(true);
    expect(fake.addLayer).toHaveBeenCalledTimes(2);
  });

  it('places one badge per feature from a rendered frame, numbered in the inspector order', () => {
    const fake = createFakeMap();
    useMapMock.mockReturnValue({ current: { getMap: () => fake.map }, default: undefined });
    const { container } = render(<AirspaceFeatureBadges />);
    act(() => {
      fake.renderFrame();
    });
    const badges = badgeElements(container);
    expect(badges.map((element) => element.textContent)).toEqual(['1', '2']);
    // Badge "1" is the 4000 ft ring at (10..11), which lands further
    // right than badge "2" at (0..1).
    expect(translateX(badges[0])).toBeGreaterThan(translateX(badges[1]));
    expect(badges[0]?.style.visibility).toBe('visible');
  });

  it('lifts badges to the box top when the camera tilts and drops them back in plan view', () => {
    const fake = createFakeMap();
    useMapMock.mockReturnValue({ current: { getMap: () => fake.map }, default: undefined });
    const { container } = render(<AirspaceFeatureBadges />);
    act(() => {
      fake.renderFrame();
    });
    const flatY = translateY(badgeElements(container)[0]);
    fake.setPitch(60);
    act(() => {
      fake.renderFrame();
    });
    const tiltedY = translateY(badgeElements(container)[0]);
    // The lifting matrix adds altitude into clip y, which maps to a
    // smaller pixel y: the badge moves up the screen.
    expect(tiltedY).toBeLessThan(flatY);
    fake.setPitch(0);
    act(() => {
      fake.renderFrame();
    });
    expect(translateY(badgeElements(container)[0])).toBeCloseTo(flatY, 6);
  });

  it('hides a badge whose anchor is behind the camera', () => {
    const fake = createFakeMap();
    useMapMock.mockReturnValue({ current: { getMap: () => fake.map }, default: undefined });
    const { container } = render(<AirspaceFeatureBadges />);
    const behind = [...LIFTING_MATRIX];
    behind[15] = -1;
    act(() => {
      fake.renderFrame(behind);
    });
    for (const element of badgeElements(container)) {
      expect(element.style.visibility).toBe('hidden');
    }
  });

  it('emphasizes the badge of the hovered inspector section', () => {
    useHoveredFeatureIndexMock.mockReturnValue(1);
    const fake = createFakeMap();
    useMapMock.mockReturnValue({ current: { getMap: () => fake.map }, default: undefined });
    const { container } = render(<AirspaceFeatureBadges />);
    const badges = badgeElements(container);
    // The emphasis sits on the inner pill, never on the positioned
    // element, so it cannot scale the badge's translation.
    expect(badges[0]?.firstElementChild?.className).not.toContain('scale-125');
    expect(badges[1]?.firstElementChild?.className).toContain('scale-125');
    expect(badges[1]?.className).not.toContain('scale-125');
  });
});
