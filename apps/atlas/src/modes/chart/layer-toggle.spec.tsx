import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LayerToggle } from './layer-toggle.tsx';
import { AIRSPACE_CLASSES, AIRWAY_CATEGORIES, LAYER_IDS } from './url-state.ts';
import type { ChartSearch } from './url-state.ts';

/** Shape of the single argument the component passes to `navigate`. */
interface NavigateArg {
  /** Updater that receives the current search and returns the next one. */
  search: (prev: ChartSearch) => ChartSearch;
  /** Whether to use history.replaceState instead of pushState. */
  replace?: boolean;
}

/** Subset of the search shape the toggle reads via `route.useSearch()`. */
type ToggleSearch = Pick<ChartSearch, 'layers' | 'airspaceClasses' | 'airwayCategories' | 'zoom'>;

const { useSearchMock, navigateMock } = vi.hoisted(() => ({
  useSearchMock: vi.fn<() => ToggleSearch>(),
  navigateMock: vi.fn<(arg: NavigateArg) => void>(),
}));

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: useSearchMock }),
  useNavigate: () => navigateMock,
}));

// Radix DropdownMenu's open/close cycle drives off pointer events that
// jsdom does not fully simulate, and its internals (portal layout,
// keyboard handling, etc.) are third-party concerns we do not want to
// pin down. Mock the primitives so menu items render unconditionally and
// row clicks call the right handler. CheckboxItem renders as a div with
// role="menuitemcheckbox" mirroring real Radix; Item is a div with
// role="menuitem" whose click triggers `onSelect` (used by expandable
// parent rows for the expand/collapse action).
vi.mock('@radix-ui/react-dropdown-menu', () => {
  function Root({ children }: { children: ReactNode }): ReactNode {
    return children;
  }
  function Trigger({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }): ReactNode {
    return (
      <button type="button" className={className}>
        {children}
      </button>
    );
  }
  function Portal({ children }: { children: ReactNode }): ReactNode {
    return children;
  }
  function Content({ children }: { children: ReactNode }): ReactNode {
    return <div>{children}</div>;
  }
  function CheckboxItem({
    children,
    checked,
    onCheckedChange,
    onKeyDown,
    className,
  }: {
    children: ReactNode;
    checked: boolean;
    onCheckedChange: (next: boolean) => void;
    onSelect?: (event: Event) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
    className?: string;
  }): ReactNode {
    const activate = (): void => onCheckedChange(!checked);
    return (
      <div
        role="menuitemcheckbox"
        aria-checked={checked}
        tabIndex={0}
        className={className}
        onClick={activate}
        onKeyDown={(event) => {
          // Run the consumer's handler first so it can preventDefault on
          // arrow keys (the unified parent row uses ArrowRight/Left for
          // expand/collapse before the menu's space/enter activation).
          onKeyDown?.(event);
          if (event.defaultPrevented) {
            return;
          }
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            activate();
          }
        }}
      >
        {children}
      </div>
    );
  }
  function ItemIndicator({ children }: { children: ReactNode }): ReactNode {
    return <span>{children}</span>;
  }
  function Item({
    children,
    onSelect,
    className,
  }: {
    children: ReactNode;
    onSelect?: (event: { preventDefault: () => void }) => void;
    className?: string;
  }): ReactNode {
    const activate = (): void => {
      onSelect?.({ preventDefault: () => undefined });
    };
    return (
      <div
        role="menuitem"
        tabIndex={0}
        className={className}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            activate();
          }
        }}
      >
        {children}
      </div>
    );
  }
  function Separator({ className }: { className?: string }): ReactNode {
    return <div role="separator" className={className} />;
  }
  return { Root, Trigger, Portal, Content, CheckboxItem, ItemIndicator, Item, Separator };
});

/**
 * Helper to read the most recent navigate call's `search` updater and apply
 * it to a stub previous state, returning what the URL would resolve to.
 */
function applyLatestSearchUpdate(prev: ChartSearch): ChartSearch {
  const lastCall = navigateMock.mock.calls.at(-1);
  if (lastCall === undefined) {
    throw new Error('navigate was not called');
  }
  return lastCall[0].search(prev);
}

/**
 * Builds a complete `ToggleSearch` with the all-on defaults plus overrides.
 * The default `zoom` is intentionally above every threshold in `LAYER_MIN_ZOOM`
 * so existing tests (which do not care about the zoom-gated hint) see no
 * extra "Zoom N+" badges in their rendered rows. Hint-specific tests override
 * `zoom` to a value below the threshold they want to exercise.
 */
function makeSearch(overrides: Partial<ToggleSearch> = {}): ToggleSearch {
  return {
    layers: [...LAYER_IDS],
    airspaceClasses: [...AIRSPACE_CLASSES],
    airwayCategories: [...AIRWAY_CATEGORIES],
    zoom: 10,
    ...overrides,
  };
}

/** Builds a complete `ChartSearch` for use as the `prev` argument in navigate updaters. */
function makePrev(overrides: Partial<ChartSearch> = {}): ChartSearch {
  return {
    lat: 0,
    lon: 0,
    zoom: 0,
    pitch: 0,
    layers: [...LAYER_IDS],
    airspaceClasses: [...AIRSPACE_CLASSES],
    airwayCategories: [...AIRWAY_CATEGORIES],
    ...overrides,
  };
}

/** Resolves the parent row for a given layer label. All parent rows are menuitemcheckbox in the unified design. */
function getParentRow(label: RegExp | string): HTMLElement {
  const items = screen.getAllByRole('menuitemcheckbox');
  const text = typeof label === 'string' ? label.toLowerCase() : label.source.toLowerCase();
  const match = items.find((el) => el.textContent?.toLowerCase().includes(text));
  if (match === undefined) {
    throw new Error(`No row matching ${label}`);
  }
  return match;
}

/** Click the chevron button inside an expandable parent row to toggle expansion. */
function expandLayer(layer: 'airways' | 'airspace'): void {
  const row = getParentRow(layer);
  const chevron = within(row).getByRole('button', {
    name: new RegExp(`(expand|collapse) ${layer} sub-list`, 'i'),
  });
  fireEvent.click(chevron);
}

/** Click the parent row body itself to toggle the layer's checked state. */
function clickParentLayer(layer: 'airways' | 'airspace' | 'airports' | 'navaids' | 'fixes'): void {
  fireEvent.click(getParentRow(layer));
}

describe('LayerToggle', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    useSearchMock.mockReturnValue(makeSearch());
  });

  it('renders the simple parent rows with checked state matching the URL layers', () => {
    useSearchMock.mockReturnValue(makeSearch({ layers: ['airports'] }));
    render(<LayerToggle />);

    expect(screen.getByRole('menuitemcheckbox', { name: /airports/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: /navaids/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: /fixes/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('renders the expandable parent rows as menuitemcheckbox reflecting the URL', () => {
    useSearchMock.mockReturnValue(makeSearch({ layers: ['airports'] }));
    render(<LayerToggle />);

    expect(getParentRow('airways')).toHaveAttribute('aria-checked', 'false');
    expect(getParentRow('airspace')).toHaveAttribute('aria-checked', 'false');
  });

  it('removes a simple layer from the URL when its row is clicked', () => {
    render(<LayerToggle />);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /fixes/i }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(makePrev());
    expect(next.layers).toEqual(['airports', 'navaids', 'airways', 'airspace']);
  });

  it('toggles an expandable parent layer when the row is clicked, without expanding it', () => {
    render(<LayerToggle />);
    clickParentLayer('airways');

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(makePrev());
    expect(next.layers).toEqual(['airports', 'navaids', 'fixes', 'airspace']);
    // Row click toggles the layer; the chevron is the separate
    // expansion affordance, so sub-rows should not have appeared.
    expect(
      screen.queryByRole('menuitemcheckbox', { name: /low altitude/i }),
    ).not.toBeInTheDocument();
  });

  it('expands the row when the chevron is clicked, without toggling the parent', () => {
    render(<LayerToggle />);
    expandLayer('airways');

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitemcheckbox', { name: /low altitude/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: /high altitude/i })).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemcheckbox', { name: /oceanic & regional/i }),
    ).toBeInTheDocument();
  });

  it('hides sub-rows again when the chevron is clicked a second time', () => {
    render(<LayerToggle />);
    expandLayer('airspace');
    expect(screen.getByRole('menuitemcheckbox', { name: /class b/i })).toBeInTheDocument();

    expandLayer('airspace');
    expect(screen.queryByRole('menuitemcheckbox', { name: /class b/i })).not.toBeInTheDocument();
  });

  it('keeps sub-rows visible when the parent layer is toggled (expansion state preserved)', () => {
    render(<LayerToggle />);
    expandLayer('airspace');
    expect(screen.getByRole('menuitemcheckbox', { name: /class b/i })).toBeInTheDocument();

    clickParentLayer('airspace');
    expect(screen.getByRole('menuitemcheckbox', { name: /class b/i })).toBeInTheDocument();
  });

  it('shows the X/Y sub-count chip on each expandable row', () => {
    useSearchMock.mockReturnValue(
      makeSearch({ airwayCategories: ['LOW'], airspaceClasses: ['CLASS_B', 'MOA'] }),
    );
    render(<LayerToggle />);

    const airwaysRow = getParentRow('airways');
    expect(within(airwaysRow).getByText('1/3')).toBeInTheDocument();
    expect(within(airwaysRow).getByLabelText('1 of 3 enabled')).toBeInTheDocument();

    const airspaceRow = getParentRow('airspace');
    expect(within(airspaceRow).getByText('2/11')).toBeInTheDocument();
    expect(within(airspaceRow).getByLabelText('2 of 11 enabled')).toBeInTheDocument();
  });

  it('reveals airway sub-rows with the new 3-bucket layout (no Colored row)', () => {
    useSearchMock.mockReturnValue(makeSearch({ airwayCategories: ['LOW', 'OCEANIC'] }));
    render(<LayerToggle />);
    expandLayer('airways');

    expect(screen.getByRole('menuitemcheckbox', { name: /low altitude/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: /oceanic & regional/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: /high altitude/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    // The retired "Colored" row should not appear anywhere in the menu.
    expect(screen.queryByRole('menuitemcheckbox', { name: /colored/i })).not.toBeInTheDocument();
  });

  it('reveals airspace sub-rows with checked state matching airspaceClasses', () => {
    useSearchMock.mockReturnValue(makeSearch({ airspaceClasses: ['CLASS_B', 'MOA'] }));
    render(<LayerToggle />);
    expandLayer('airspace');

    expect(screen.getByRole('menuitemcheckbox', { name: /class b/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: /^moa$/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: /class c/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('menuitemcheckbox', { name: /^artcc$/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('removes an airspace class when its sub-row is unchecked', () => {
    render(<LayerToggle />);
    expandLayer('airspace');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /^artcc$/i }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(makePrev());
    expect(next.airspaceClasses).toEqual([
      'CLASS_B',
      'CLASS_C',
      'CLASS_D',
      'CLASS_E',
      'MOA',
      'RESTRICTED',
      'PROHIBITED',
      'WARNING',
      'ALERT',
      'NSA',
    ]);
    expect(next.airwayCategories).toEqual([...AIRWAY_CATEGORIES]);
    expect(next.layers).toEqual([...LAYER_IDS]);
  });

  it('removes an airway category when its sub-row is unchecked', () => {
    render(<LayerToggle />);
    expandLayer('airways');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /oceanic & regional/i }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(makePrev());
    expect(next.airwayCategories).toEqual(['LOW', 'HIGH']);
    expect(next.airspaceClasses).toEqual([...AIRSPACE_CLASSES]);
    expect(next.layers).toEqual([...LAYER_IDS]);
  });

  it('adds an airspace class back in canonical AIRSPACE_CLASSES order', () => {
    useSearchMock.mockReturnValue(makeSearch({ airspaceClasses: ['CLASS_B', 'ARTCC'] }));
    render(<LayerToggle />);
    expandLayer('airspace');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /^moa$/i }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(makePrev({ airspaceClasses: ['CLASS_B', 'ARTCC'] }));
    expect(next.airspaceClasses).toEqual(['CLASS_B', 'MOA', 'ARTCC']);
  });

  it('auto-unchecks the parent layer when the last sub-filter is unchecked', () => {
    useSearchMock.mockReturnValue(
      makeSearch({ layers: [...LAYER_IDS], airwayCategories: ['LOW'] }),
    );
    render(<LayerToggle />);
    expandLayer('airways');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /low altitude/i }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(
      makePrev({ layers: [...LAYER_IDS], airwayCategories: ['LOW'] }),
    );
    expect(next.airwayCategories).toEqual([]);
    expect(next.layers).toEqual(['airports', 'navaids', 'fixes', 'airspace']);
  });

  it('auto-checks the parent layer when a sub-filter is checked from an empty sub-array', () => {
    useSearchMock.mockReturnValue(
      makeSearch({
        layers: ['airports', 'navaids', 'fixes', 'airspace'],
        airwayCategories: [],
      }),
    );
    render(<LayerToggle />);
    expandLayer('airways');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /high altitude/i }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(
      makePrev({
        layers: ['airports', 'navaids', 'fixes', 'airspace'],
        airwayCategories: [],
      }),
    );
    expect(next.airwayCategories).toEqual(['HIGH']);
    expect(next.layers).toEqual([...LAYER_IDS]);
  });

  it('refills the sub-array to all-on when re-checking the parent of an emptied layer', () => {
    useSearchMock.mockReturnValue(
      makeSearch({
        layers: ['airports', 'navaids', 'fixes', 'airspace'],
        airwayCategories: [],
      }),
    );
    render(<LayerToggle />);
    clickParentLayer('airways');

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(
      makePrev({
        layers: ['airports', 'navaids', 'fixes', 'airspace'],
        airwayCategories: [],
      }),
    );
    expect(next.layers).toEqual([...LAYER_IDS]);
    expect(next.airwayCategories).toEqual([...AIRWAY_CATEGORIES]);
  });

  it('preserves a non-empty sub-array when re-checking the parent', () => {
    useSearchMock.mockReturnValue(
      makeSearch({
        layers: ['airports', 'navaids', 'fixes', 'airspace'],
        airwayCategories: ['LOW', 'HIGH'],
      }),
    );
    render(<LayerToggle />);
    clickParentLayer('airways');

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(
      makePrev({
        layers: ['airports', 'navaids', 'fixes', 'airspace'],
        airwayCategories: ['LOW', 'HIGH'],
      }),
    );
    expect(next.layers).toEqual([...LAYER_IDS]);
    expect(next.airwayCategories).toEqual(['LOW', 'HIGH']);
  });

  it('leaves an explicitly-off parent alone when the user adjusts non-empty sub-rows', () => {
    useSearchMock.mockReturnValue(
      makeSearch({
        layers: ['airports', 'navaids', 'fixes', 'airspace'],
        airwayCategories: ['LOW', 'HIGH'],
      }),
    );
    render(<LayerToggle />);
    expandLayer('airways');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /high altitude/i }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    const next = applyLatestSearchUpdate(
      makePrev({
        layers: ['airports', 'navaids', 'fixes', 'airspace'],
        airwayCategories: ['LOW', 'HIGH'],
      }),
    );
    expect(next.airwayCategories).toEqual(['LOW']);
    // Parent stays off because the sub-array did not transition out of empty.
    expect(next.layers).toEqual(['airports', 'navaids', 'fixes', 'airspace']);
  });

  it('expands on ArrowRight and collapses on ArrowLeft (keyboard tree-style nav)', () => {
    render(<LayerToggle />);
    const airwaysRow = getParentRow('airways');

    // ArrowRight on a collapsed expandable row expands it without
    // toggling the parent layer.
    fireEvent.keyDown(airwaysRow, { key: 'ArrowRight' });
    expect(screen.getByRole('menuitemcheckbox', { name: /low altitude/i })).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();

    // ArrowLeft on an expanded row collapses it.
    fireEvent.keyDown(airwaysRow, { key: 'ArrowLeft' });
    expect(
      screen.queryByRole('menuitemcheckbox', { name: /low altitude/i }),
    ).not.toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  describe('zoom-gated hints', () => {
    it('shows the hint on every gated row when current zoom is below all thresholds', () => {
      // At zoom 4 (the chart-mode default), navaids (minzoom 5) and fixes
      // (minzoom 7) are gated. Each row should advertise its own threshold
      // so a user toggling that layer on knows when it will appear. Airways
      // does not carry the hint here even though some of its features are
      // zoom-gated internally - the layer always renders the major
      // (HIGH-altitude) backbone, so toggling it on is never a "nothing
      // happens" experience.
      useSearchMock.mockReturnValue(makeSearch({ zoom: 4 }));
      render(<LayerToggle />);

      expect(within(getParentRow('fixes')).getByText('Zoom 7+')).toBeInTheDocument();
      expect(within(getParentRow('navaids')).getByText('Zoom 5+')).toBeInTheDocument();
      expect(within(getParentRow('airways')).queryByText(/Zoom \d+\+/)).toBeNull();
    });

    it('omits the hint for layers that have no minzoom regardless of current zoom', () => {
      useSearchMock.mockReturnValue(makeSearch({ zoom: 4 }));
      render(<LayerToggle />);

      // airports, airspace, and airways have no entry in LAYER_MIN_ZOOM
      // and must never carry the hint, even at the lowest zoom levels.
      // (Airways gates non-major features internally; see the airways
      // layer for the per-feature filter.)
      expect(within(getParentRow('airports')).queryByText(/Zoom \d+\+/)).toBeNull();
      expect(within(getParentRow('airspace')).queryByText(/Zoom \d+\+/)).toBeNull();
      expect(within(getParentRow('airways')).queryByText(/Zoom \d+\+/)).toBeNull();
    });

    it('hides the hint once the current zoom has reached the layer threshold', () => {
      // At zoom 5 the navaid gate has just opened (minzoom 5), so its
      // hint disappears; fixes (minzoom 7) is still ahead. Airways
      // never carries the hint at any zoom (gating is per-feature).
      useSearchMock.mockReturnValue(makeSearch({ zoom: 5 }));
      render(<LayerToggle />);

      expect(within(getParentRow('navaids')).queryByText(/Zoom \d+\+/)).toBeNull();
      expect(within(getParentRow('airways')).queryByText(/Zoom \d+\+/)).toBeNull();
      expect(within(getParentRow('fixes')).getByText('Zoom 7+')).toBeInTheDocument();
    });

    it('hides the hint on every row when current zoom is above all thresholds', () => {
      useSearchMock.mockReturnValue(makeSearch({ zoom: 12 }));
      render(<LayerToggle />);

      for (const id of ['airports', 'navaids', 'fixes', 'airways', 'airspace'] as const) {
        expect(within(getParentRow(id)).queryByText(/Zoom \d+\+/)).toBeNull();
      }
    });

    it('exposes the threshold to assistive tech via aria-label', () => {
      useSearchMock.mockReturnValue(makeSearch({ zoom: 4 }));
      render(<LayerToggle />);

      // Screen readers benefit from the full sentence rather than the
      // compact "Zoom 7+" glyph; aria-label is the canonical mechanism here.
      expect(
        within(getParentRow('fixes')).getByLabelText('Appears at zoom 7 and above'),
      ).toBeInTheDocument();
    });
  });
});
