import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisambiguationPopover } from './disambiguation-popover.tsx';
import { HighlightProvider } from './highlight-provider.tsx';
import type { InspectableFeature } from './click-to-select.ts';
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
