import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { InspectableFeature } from './click-to-select.ts';
import { DisambiguationPopover } from './disambiguation-popover.tsx';
import { HighlightProvider } from './highlight-provider.tsx';
import { AIRPORTS_LAYER_ID } from './layers/airports-layer.tsx';
import { AIRSPACE_FILL_LAYER_ID, AIRSPACE_LINE_LAYER_ID } from './layers/airspace-layer.tsx';
import { AIRWAYS_LAYER_ID } from './layers/airways-layer.tsx';
import { FIXES_LAYER_ID } from './layers/fixes-layer.tsx';
import { NAVAIDS_LAYER_ID } from './layers/navaids-layer.tsx';

const { useMapMock, onMock, offMock } = vi.hoisted(() => ({
  useMapMock: vi.fn(),
  onMock: vi.fn(),
  offMock: vi.fn(),
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  useMap: useMapMock,
}));

/** Builds a minimal `InspectableFeature` for use as a popover candidate. */
function buildFeature(layerId: string, properties: Record<string, unknown>): InspectableFeature {
  return { layer: { id: layerId }, properties };
}

/**
 * Pulls the `movestart` handler that the popover most recently
 * registered with the map. Tests fire it directly to simulate a
 * pan/zoom without driving real MapLibre internals.
 */
function getMoveStartHandler(): (() => void) | undefined {
  const call = onMock.mock.calls.find((entry) => entry[0] === 'movestart');
  const handler = call?.[1];
  return typeof handler === 'function' ? (handler as () => void) : undefined;
}

/**
 * Wrapper that mounts a real `HighlightProvider` so the popover's
 * `useSetHoveredChipSelection` hook resolves. The setter is a vi.fn
 * passed in so each test can assert against it.
 */
function withProvider(
  setHoveredChipSelection: (selection: string | undefined) => void,
): (props: { children: ReactNode }) => ReactElement {
  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <HighlightProvider
        activeHighlight={undefined}
        setHoveredChipSelection={setHoveredChipSelection}
        hoveredFeatureIndex={undefined}
        setHoveredFeatureIndex={vi.fn()}
        hoveredAirwayWaypointIndex={undefined}
        setHoveredAirwayWaypointIndex={vi.fn()}
      >
        {children}
      </HighlightProvider>
    );
  }
  return Wrapper;
}

describe('DisambiguationPopover', () => {
  beforeEach(() => {
    onMock.mockClear();
    offMock.mockClear();
    useMapMock.mockReturnValue({
      default: {
        getMap: () => ({ on: onMock, off: offMock }),
      },
    });
  });

  it('renders one row per encodeable candidate, with type and label', () => {
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    render(
      <DisambiguationPopover
        screen={{ x: 100, y: 200 }}
        candidates={[v16, v44]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    const v16Row = screen.getByRole('menuitem', { name: /v16/i });
    expect(v16Row).toHaveTextContent(/airway/i);
    expect(v16Row).toHaveTextContent('V16');
    expect(screen.getByRole('menuitem', { name: /v44/i })).toBeInTheDocument();
  });

  it('dedupes candidates that resolve to the same encoded selection', () => {
    // A Class B fill and outline feature both encode to airspace:CLASS_B/JFK.
    // The popover should collapse them to a single row.
    const fill = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    const line = buildFeature(AIRSPACE_LINE_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    const navaid = buildFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[fill, line, navaid]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(2);
  });

  it('drops candidates whose layer is not encodeable', () => {
    const airport = buildFeature(AIRPORTS_LAYER_ID, { faaId: 'BOS' });
    const navaid = buildFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' });
    const unknown = buildFeature('atlas-future-layer', { faaId: 'XYZ' });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[airport, navaid, unknown]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(2);
  });

  it('renders nothing when fewer than 2 entries survive deduping', () => {
    const fill = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    const line = buildFeature(AIRSPACE_LINE_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    const { container } = render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[fill, line]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onSelect with the encoded selection when a row is clicked', () => {
    const onSelect = vi.fn();
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[v16, v44]}
        onSelect={onSelect}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /v44/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('airway:V44');
  });

  it('positions itself relative to the click pixel with the configured offset', () => {
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    render(
      <DisambiguationPopover
        screen={{ x: 250, y: 175 }}
        candidates={[v16, v44]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '258px', top: '183px' });
  });

  it('clamps the popover up when the click is near the bottom of the map', () => {
    // jsdom does not run real layout, so element rects come back as
    // zeros - the clamp logic short-circuits in that case. Force the
    // measured rects to mimic a 1280 x 600 parent with a 200 x 240
    // popover whose anchor (top=520) would push 60px past the
    // parent's bottom. The clamp should snap the popover up so its
    // bottom sits 8px inside the parent.
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      if (this.getAttribute('role') === 'menu') {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 200,
          bottom: 240,
          width: 200,
          height: 240,
        } as DOMRect;
      }
      // Every other element (the test wrapper acting as the popover's
      // positioned ancestor) reports the simulated parent size.
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 1280,
        bottom: 600,
        width: 1280,
        height: 600,
      } as DOMRect;
    };
    try {
      render(
        <DisambiguationPopover
          screen={{ x: 200, y: 512 }}
          candidates={[v16, v44]}
          onSelect={vi.fn()}
          onDismiss={vi.fn()}
        />,
        { wrapper: withProvider(vi.fn()) },
      );
      const menu = screen.getByRole('menu');
      // anchorY = 512 + 8 = 520. 520 + 240 = 760 > 600 - 8 = 592.
      // Clamped top = 600 - 240 - 8 = 352.
      // anchorX = 200 + 8 = 208. 208 + 200 = 408 < 1272, no horizontal clamp.
      expect(menu).toHaveStyle({ left: '208px', top: '352px' });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });

  it('leaves the popover at its anchor when it fits naturally inside the parent', () => {
    // No-clamp regression test: a click near the top-left of the map
    // produces a popover whose bottom and right both fit comfortably
    // inside a 1280 x 600 parent. The clamp must NOT pull the popover
    // away from the click in that case - otherwise users see the
    // popover snap to the corner regardless of where they clicked.
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      if (this.getAttribute('role') === 'menu') {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 200,
          bottom: 240,
          width: 200,
          height: 240,
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 1280,
        bottom: 600,
        width: 1280,
        height: 600,
      } as DOMRect;
    };
    try {
      render(
        <DisambiguationPopover
          screen={{ x: 100, y: 80 }}
          candidates={[v16, v44]}
          onSelect={vi.fn()}
          onDismiss={vi.fn()}
        />,
        { wrapper: withProvider(vi.fn()) },
      );
      const menu = screen.getByRole('menu');
      // anchorX = 108, anchorY = 88. Popover (200x240) ends at 308x328,
      // both inside the 1280x600 parent (minus 8px breathing room).
      // Position should equal the anchor.
      expect(menu).toHaveStyle({ left: '108px', top: '88px' });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });

  it('clamps the popover left when the click is near the right edge of the map', () => {
    // Horizontal overflow companion to the bottom-overflow case.
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      if (this.getAttribute('role') === 'menu') {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 200,
          bottom: 240,
          width: 200,
          height: 240,
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 1280,
        bottom: 600,
        width: 1280,
        height: 600,
      } as DOMRect;
    };
    try {
      render(
        <DisambiguationPopover
          screen={{ x: 1180, y: 100 }}
          candidates={[v16, v44]}
          onSelect={vi.fn()}
          onDismiss={vi.fn()}
        />,
        { wrapper: withProvider(vi.fn()) },
      );
      const menu = screen.getByRole('menu');
      // anchorX = 1188. 1188 + 200 = 1388 > 1280 - 8 = 1272.
      // Clamped left = 1280 - 200 - 8 = 1072. anchorY = 108 fits.
      expect(menu).toHaveStyle({ left: '1072px', top: '108px' });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });

  it('calls setHoveredChipSelection on hover and on mouse leave', () => {
    const setter = vi.fn();
    const navaid = buildFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' });
    const fix = buildFeature(FIXES_LAYER_ID, { identifier: 'MERIT' });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[navaid, fix]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(setter) },
    );

    const navaidRow = screen.getByRole('menuitem', { name: /bos/i });
    fireEvent.mouseEnter(navaidRow);
    expect(setter).toHaveBeenLastCalledWith('navaid:BOS');
    fireEvent.mouseLeave(navaidRow);
    expect(setter).toHaveBeenLastCalledWith(undefined);
  });

  it('dismisses on Escape', () => {
    const onDismiss = vi.fn();
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[v16, v44]}
        onSelect={vi.fn()}
        onDismiss={onDismiss}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss on unrelated keys', () => {
    const onDismiss = vi.fn();
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[v16, v44]}
        onSelect={vi.fn()}
        onDismiss={onDismiss}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses when the underlying map fires movestart', () => {
    const onDismiss = vi.fn();
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[v16, v44]}
        onSelect={vi.fn()}
        onDismiss={onDismiss}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const handler = getMoveStartHandler();
    expect(handler).toBeDefined();
    handler?.();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('orders airspace rows by altitude descending and keeps non-airspace rows ahead of them', () => {
    // MapLibre's z-order returns points/lines before polygons, so a
    // realistic candidate list looks like [airport, low MOA, high MOA].
    // After the popover's sort, the airport stays first (it has no
    // altitude key) and the airspace rows reorder to high-then-low so
    // the popover reads top-down by altitude.
    const airport = buildFeature(AIRPORTS_LAYER_ID, { faaId: 'BOS' });
    const moaLow = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'MOA',
      identifier: 'MEUREKAL',
      __atlasFloorFt: 0,
      __atlasFloorRef: 'SFC',
      __atlasCeilingFt: 10000,
      __atlasCeilingRef: 'MSL',
    });
    const moaHigh = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'MOA',
      identifier: 'MEUREKAH',
      __atlasFloorFt: 11000,
      __atlasFloorRef: 'MSL',
      __atlasCeilingFt: 18000,
      __atlasCeilingRef: 'MSL',
    });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[airport, moaLow, moaHigh]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const rows = screen.getAllByRole('menuitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('BOS');
    expect(rows[1]).toHaveTextContent('MEUREKAH');
    expect(rows[2]).toHaveTextContent('MEUREKAL');
  });

  it('breaks airspace ties by floor descending so concentric Class B rings read outer-first', () => {
    // Inner ring (10k/SFC) and outer ring (10k/3000 MSL) share a
    // ceiling. The outer ring's higher floor should put it first when
    // ceilings tie, matching the chart "altitude band, top down" model.
    const innerRing = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'CLASS_B',
      identifier: 'JFK-INNER',
      __atlasFloorFt: 0,
      __atlasFloorRef: 'SFC',
      __atlasCeilingFt: 10000,
      __atlasCeilingRef: 'MSL',
    });
    const outerRing = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'CLASS_B',
      identifier: 'JFK-OUTER',
      __atlasFloorFt: 3000,
      __atlasFloorRef: 'MSL',
      __atlasCeilingFt: 10000,
      __atlasCeilingRef: 'MSL',
    });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[innerRing, outerRing]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const rows = screen.getAllByRole('menuitem');
    expect(rows[0]).toHaveTextContent('JFK-OUTER');
    expect(rows[1]).toHaveTextContent('JFK-INNER');
  });

  it('renders an altitude subtitle for airspace rows that distinguishes vertically-stacked features', () => {
    // Two MOA components with the same lateral polygon but different
    // altitude bands (the MEUREKAH/MEUREKAL pattern). Without the
    // subtitle the rows would be visually indistinguishable in the
    // popover and on the map highlight. The popover reads flat
    // primitives that `projectAirspaceSource` adds at projection time;
    // tests mirror those by setting the primitive properties directly.
    const moaHigh = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'MOA',
      identifier: 'MEUREKAH',
      __atlasFloorFt: 11000,
      __atlasFloorRef: 'MSL',
      __atlasCeilingFt: 18000,
      __atlasCeilingRef: 'MSL',
    });
    const moaLow = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'MOA',
      identifier: 'MEUREKAL',
      __atlasFloorFt: 0,
      __atlasFloorRef: 'SFC',
      __atlasCeilingFt: 10000,
      __atlasCeilingRef: 'MSL',
    });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[moaHigh, moaLow]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const highRow = screen.getByRole('menuitem', { name: /meurekah/i });
    expect(highRow).toHaveTextContent('11k-18k');
    const lowRow = screen.getByRole('menuitem', { name: /meurekal/i });
    expect(lowRow).toHaveTextContent('SFC-10k');
  });

  it('renders an AGL suffix on altitude bounds with AGL reference', () => {
    // A Class E5 polygon whose floor is 700 AGL and ceiling is at FL180
    // (17999 MSL). The AGL suffix matters: 700 AGL and 700 MSL are very
    // different airspace floors.
    const classE5 = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'CLASS_E5',
      identifier: 'BILLINGS',
      __atlasFloorFt: 700,
      __atlasFloorRef: 'AGL',
      __atlasCeilingFt: 17999,
      __atlasCeilingRef: 'MSL',
    });
    const moa = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'MOA',
      identifier: 'OTHER',
      __atlasFloorFt: 0,
      __atlasFloorRef: 'SFC',
      __atlasCeilingFt: 10000,
      __atlasCeilingRef: 'MSL',
    });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[classE5, moa]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const e5Row = screen.getByRole('menuitem', { name: /billings/i });
    expect(e5Row).toHaveTextContent('700ft AGL-17999ft');
  });

  it('omits the subtitle when airspace altitude bounds are missing or malformed', () => {
    // A feature whose properties bag lacks floor/ceiling primitives
    // (e.g. a hand-built feature or one where projection failed). The
    // row should still render but without a subtitle.
    const a = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'MOA', identifier: 'OK' });
    const b = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'MOA',
      identifier: 'OTHER',
      __atlasFloorFt: 11000,
      __atlasFloorRef: 'MSL',
      __atlasCeilingFt: 18000,
      __atlasCeilingRef: 'MSL',
    });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[a, b]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const okRow = screen.getByRole('menuitem', { name: /moa ok/i });
    expect(okRow).not.toHaveTextContent(/k-/);
    const otherRow = screen.getByRole('menuitem', { name: /other/i });
    expect(otherRow).toHaveTextContent('11k-18k');
  });

  it('omits the subtitle for non-airspace rows', () => {
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[v16, v44]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    const v16Row = screen.getByRole('menuitem', { name: /v16/i });
    expect(v16Row).not.toHaveTextContent(/k-/);
  });

  it('unsubscribes from the map and window when unmounted', () => {
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    const { unmount } = render(
      <DisambiguationPopover
        screen={{ x: 0, y: 0 }}
        candidates={[v16, v44]}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
      { wrapper: withProvider(vi.fn()) },
    );

    unmount();
    expect(offMock).toHaveBeenCalledWith('movestart', expect.any(Function));
  });
});
