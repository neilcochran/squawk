import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AIRSPACE_CLASSES, AIRWAY_CATEGORIES, CHART_DEFAULTS, LAYER_IDS } from '../url-state.ts';
import type { ChartSearch } from '../url-state.ts';

import { SearchFilterMenu } from './search-filter-menu.tsx';

/** Shape of the single argument the component passes to `navigate`. */
interface NavigateArg {
  /** Updater that receives the current search and returns the next one. */
  search: (prev: ChartSearch) => ChartSearch;
  /** Whether to use history.replaceState instead of pushState. */
  replace?: boolean;
}

/** Subset of the search shape the filter menu reads via `route.useSearch()`. */
type FilterSearch = Pick<
  ChartSearch,
  | 'layers'
  | 'airspaceClasses'
  | 'airwayCategories'
  | 'searchLayers'
  | 'searchAirspaceClasses'
  | 'searchAirwayCategories'
  | 'searchIncludeHidden'
>;

const { useSearchMock, navigateMock } = vi.hoisted(() => ({
  useSearchMock: vi.fn<() => FilterSearch>(),
  navigateMock: vi.fn<(arg: NavigateArg) => void>(),
}));

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: useSearchMock }),
  useNavigate: () => navigateMock,
}));

// Radix DropdownMenu's open/close cycle drives off pointer events that jsdom
// does not fully simulate, and its internals (portal layout, keyboard handling,
// etc.) are third-party concerns we do not want to pin down. Mock the
// primitives so the trigger and every menu item render unconditionally and row
// clicks call the right handler. The Trigger forwards `aria-label` so the
// active-filter state (which the funnel dot signals visually) can be asserted
// through the button's accessible name. CheckboxItem renders as a div with
// role="menuitemcheckbox" mirroring real Radix and passes `className` through so
// the dimming style can be read off the row.
vi.mock('@radix-ui/react-dropdown-menu', () => {
  function Root({ children }: { children: ReactNode }): ReactNode {
    return children;
  }
  function Trigger({
    children,
    className,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    className?: string;
    'aria-label'?: string;
  }): ReactNode {
    return (
      <button type="button" className={className} aria-label={ariaLabel}>
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
    disabled,
    className,
  }: {
    children: ReactNode;
    onSelect?: (event: { preventDefault: () => void }) => void;
    disabled?: boolean;
    className?: string;
  }): ReactNode {
    const activate = (): void => {
      if (disabled === true) {
        return;
      }
      onSelect?.({ preventDefault: () => undefined });
    };
    return (
      <div
        role="menuitem"
        aria-disabled={disabled === true ? true : undefined}
        tabIndex={disabled === true ? -1 : 0}
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
 * Reads the most recent navigate call's `search` updater and applies it to a
 * stub previous state, returning what the URL would resolve to. The handlers
 * always overwrite the fields they own from the component's current props
 * (not from `prev`), so `prev` only needs to carry the fields a test does not
 * assert on.
 */
function applyLatestSearchUpdate(prev: ChartSearch): ChartSearch {
  const lastCall = navigateMock.mock.calls.at(-1);
  if (lastCall === undefined) {
    throw new Error('navigate was not called');
  }
  return lastCall[0].search(prev);
}

/** Builds a complete `FilterSearch` with the all-on / include-hidden-off defaults plus overrides. */
function makeSearch(overrides: Partial<FilterSearch> = {}): FilterSearch {
  return {
    layers: [...LAYER_IDS],
    airspaceClasses: [...AIRSPACE_CLASSES],
    airwayCategories: [...AIRWAY_CATEGORIES],
    searchLayers: [...LAYER_IDS],
    searchAirspaceClasses: [...AIRSPACE_CLASSES],
    searchAirwayCategories: [...AIRWAY_CATEGORIES],
    searchIncludeHidden: false,
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
    searchLayers: [...LAYER_IDS],
    searchAirspaceClasses: [...AIRSPACE_CLASSES],
    searchAirwayCategories: [...AIRWAY_CATEGORIES],
    searchIncludeHidden: false,
    ...overrides,
  };
}

/** Resolves the parent row for a given layer label. All parent rows are menuitemcheckbox. */
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

/** Resolves the master include-hidden toggle row. */
function getIncludeHiddenRow(): HTMLElement {
  return screen.getByRole('menuitemcheckbox', { name: /include hidden features/i });
}

describe('SearchFilterMenu', () => {
  beforeEach(() => {
    navigateMock.mockClear();
    useSearchMock.mockReturnValue(makeSearch());
  });

  it('renders the funnel trigger and the include-hidden master toggle', () => {
    render(<SearchFilterMenu />);

    expect(screen.getByRole('button', { name: 'Search filters' })).toBeInTheDocument();
    expect(getIncludeHiddenRow()).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects the search layers as checked state on the parent rows', () => {
    useSearchMock.mockReturnValue(makeSearch({ searchLayers: ['airports'] }));
    render(<SearchFilterMenu />);

    expect(getParentRow('airports')).toHaveAttribute('aria-checked', 'true');
    expect(getParentRow('navaids')).toHaveAttribute('aria-checked', 'false');
    expect(getParentRow('fixes')).toHaveAttribute('aria-checked', 'false');
    expect(getParentRow('airways')).toHaveAttribute('aria-checked', 'false');
    expect(getParentRow('airspace')).toHaveAttribute('aria-checked', 'false');
  });

  describe('active-filter indicator', () => {
    it('shows the inactive label when nothing is narrowed and include-hidden is off', () => {
      render(<SearchFilterMenu />);

      expect(screen.getByRole('button', { name: 'Search filters' })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Search filters (filters applied)' }),
      ).not.toBeInTheDocument();
    });

    it('marks filters applied when include-hidden is on', () => {
      useSearchMock.mockReturnValue(makeSearch({ searchIncludeHidden: true }));
      render(<SearchFilterMenu />);

      expect(
        screen.getByRole('button', { name: 'Search filters (filters applied)' }),
      ).toBeInTheDocument();
    });

    it('marks filters applied when the search layer set is narrowed', () => {
      useSearchMock.mockReturnValue(makeSearch({ searchLayers: ['airports'] }));
      render(<SearchFilterMenu />);

      expect(
        screen.getByRole('button', { name: 'Search filters (filters applied)' }),
      ).toBeInTheDocument();
    });

    it('marks filters applied when the searchable airspace classes are narrowed', () => {
      useSearchMock.mockReturnValue(makeSearch({ searchAirspaceClasses: ['CLASS_B'] }));
      render(<SearchFilterMenu />);

      expect(
        screen.getByRole('button', { name: 'Search filters (filters applied)' }),
      ).toBeInTheDocument();
    });

    it('marks filters applied when the searchable airway categories are narrowed', () => {
      useSearchMock.mockReturnValue(makeSearch({ searchAirwayCategories: ['LOW'] }));
      render(<SearchFilterMenu />);

      expect(
        screen.getByRole('button', { name: 'Search filters (filters applied)' }),
      ).toBeInTheDocument();
    });
  });

  describe('include-hidden master toggle', () => {
    it('turns include-hidden on when the toggle is clicked', () => {
      render(<SearchFilterMenu />);
      fireEvent.click(getIncludeHiddenRow());

      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(applyLatestSearchUpdate(makePrev()).searchIncludeHidden).toBe(true);
    });

    it('turns include-hidden off when it is already on', () => {
      useSearchMock.mockReturnValue(makeSearch({ searchIncludeHidden: true }));
      render(<SearchFilterMenu />);
      expect(getIncludeHiddenRow()).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(getIncludeHiddenRow());
      expect(navigateMock).toHaveBeenCalledTimes(1);
      expect(
        applyLatestSearchUpdate(makePrev({ searchIncludeHidden: true })).searchIncludeHidden,
      ).toBe(false);
    });
  });

  describe('search-layer filtering', () => {
    it('removes a simple layer from searchLayers when its row is clicked', () => {
      render(<SearchFilterMenu />);
      clickParentLayer('fixes');

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(makePrev());
      expect(next.searchLayers).toEqual(['airports', 'navaids', 'airways', 'airspace']);
    });

    it('toggles an expandable parent in searchLayers without expanding it', () => {
      render(<SearchFilterMenu />);
      clickParentLayer('airways');

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(makePrev());
      expect(next.searchLayers).toEqual(['airports', 'navaids', 'fixes', 'airspace']);
      expect(
        screen.queryByRole('menuitemcheckbox', { name: /low altitude/i }),
      ).not.toBeInTheDocument();
    });

    it('reveals airspace sub-rows reflecting searchAirspaceClasses', () => {
      useSearchMock.mockReturnValue(makeSearch({ searchAirspaceClasses: ['CLASS_B', 'MOA'] }));
      render(<SearchFilterMenu />);
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
    });

    it('removes an airway category from searchAirwayCategories when its sub-row is unchecked', () => {
      render(<SearchFilterMenu />);
      expandLayer('airways');
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /oceanic & regional/i }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(makePrev());
      expect(next.searchAirwayCategories).toEqual(['LOW', 'HIGH']);
      expect(next.searchLayers).toEqual([...LAYER_IDS]);
    });
  });

  describe('sub-class parent coupling', () => {
    it('auto-unchecks the airspace parent when the last searchable class is unchecked', () => {
      useSearchMock.mockReturnValue(
        makeSearch({ searchLayers: [...LAYER_IDS], searchAirspaceClasses: ['CLASS_B'] }),
      );
      render(<SearchFilterMenu />);
      expandLayer('airspace');
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /class b/i }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(
        makePrev({ searchLayers: [...LAYER_IDS], searchAirspaceClasses: ['CLASS_B'] }),
      );
      expect(next.searchAirspaceClasses).toEqual([]);
      expect(next.searchLayers).toEqual(['airports', 'navaids', 'fixes', 'airways']);
    });

    it('auto-checks the airways parent when a category is checked from empty', () => {
      useSearchMock.mockReturnValue(
        makeSearch({
          searchLayers: ['airports', 'navaids', 'fixes', 'airspace'],
          searchAirwayCategories: [],
        }),
      );
      render(<SearchFilterMenu />);
      expandLayer('airways');
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /high altitude/i }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(
        makePrev({
          searchLayers: ['airports', 'navaids', 'fixes', 'airspace'],
          searchAirwayCategories: [],
        }),
      );
      expect(next.searchAirwayCategories).toEqual(['HIGH']);
      expect(next.searchLayers).toEqual([...LAYER_IDS]);
    });

    it('refills the searchable airway categories when the emptied parent is re-checked', () => {
      useSearchMock.mockReturnValue(
        makeSearch({
          searchLayers: ['airports', 'navaids', 'fixes', 'airspace'],
          searchAirwayCategories: [],
        }),
      );
      render(<SearchFilterMenu />);
      clickParentLayer('airways');

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(
        makePrev({
          searchLayers: ['airports', 'navaids', 'fixes', 'airspace'],
          searchAirwayCategories: [],
        }),
      );
      expect(next.searchLayers).toEqual([...LAYER_IDS]);
      expect(next.searchAirwayCategories).toEqual([...AIRWAY_CATEGORIES]);
    });

    it('refills the searchable airspace classes when the emptied parent is re-checked', () => {
      useSearchMock.mockReturnValue(
        makeSearch({
          searchLayers: ['airports', 'navaids', 'fixes', 'airways'],
          searchAirspaceClasses: [],
        }),
      );
      render(<SearchFilterMenu />);
      clickParentLayer('airspace');

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(
        makePrev({
          searchLayers: ['airports', 'navaids', 'fixes', 'airways'],
          searchAirspaceClasses: [],
        }),
      );
      expect(next.searchLayers).toEqual([...LAYER_IDS]);
      expect(next.searchAirspaceClasses).toEqual([...AIRSPACE_CLASSES]);
    });

    it('preserves a non-empty searchable sub-array when the parent is re-checked', () => {
      useSearchMock.mockReturnValue(
        makeSearch({
          searchLayers: ['airports', 'navaids', 'fixes', 'airspace'],
          searchAirwayCategories: ['LOW', 'HIGH'],
        }),
      );
      render(<SearchFilterMenu />);
      clickParentLayer('airways');

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(
        makePrev({
          searchLayers: ['airports', 'navaids', 'fixes', 'airspace'],
          searchAirwayCategories: ['LOW', 'HIGH'],
        }),
      );
      expect(next.searchLayers).toEqual([...LAYER_IDS]);
      expect(next.searchAirwayCategories).toEqual(['LOW', 'HIGH']);
    });

    it('leaves an explicitly-off parent alone when non-empty sub-rows are adjusted', () => {
      useSearchMock.mockReturnValue(
        makeSearch({
          searchLayers: ['airports', 'navaids', 'fixes', 'airspace'],
          searchAirwayCategories: ['LOW', 'HIGH'],
        }),
      );
      render(<SearchFilterMenu />);
      expandLayer('airways');
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /high altitude/i }));

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(
        makePrev({
          searchLayers: ['airports', 'navaids', 'fixes', 'airspace'],
          searchAirwayCategories: ['LOW', 'HIGH'],
        }),
      );
      expect(next.searchAirwayCategories).toEqual(['LOW']);
      expect(next.searchLayers).toEqual(['airports', 'navaids', 'fixes', 'airspace']);
    });
  });

  describe('dimming (hidden-on-map rows)', () => {
    it('dims a parent row whose layer is hidden on the map while include-hidden is off', () => {
      useSearchMock.mockReturnValue(
        makeSearch({ layers: ['airports', 'fixes', 'airways', 'airspace'] }),
      );
      render(<SearchFilterMenu />);

      expect(getParentRow('navaids').className).toContain('opacity-60');
      expect(getParentRow('airports').className).not.toContain('opacity-60');
    });

    it('dims an expandable parent that draws nothing because its sub-array is empty', () => {
      useSearchMock.mockReturnValue(makeSearch({ layers: [...LAYER_IDS], airwayCategories: [] }));
      render(<SearchFilterMenu />);

      expect(getParentRow('airways').className).toContain('opacity-60');
      expect(getParentRow('airspace').className).not.toContain('opacity-60');
    });

    it('does not dim parent rows when include-hidden is on', () => {
      useSearchMock.mockReturnValue(makeSearch({ layers: [], searchIncludeHidden: true }));
      render(<SearchFilterMenu />);

      expect(getParentRow('navaids').className).not.toContain('opacity-60');
      expect(getParentRow('airways').className).not.toContain('opacity-60');
    });

    it('dims a sub-row whose sub-class is hidden on the map while include-hidden is off', () => {
      useSearchMock.mockReturnValue(makeSearch({ airspaceClasses: ['CLASS_B'] }));
      render(<SearchFilterMenu />);
      expandLayer('airspace');

      expect(screen.getByRole('menuitemcheckbox', { name: /class b/i }).className).not.toContain(
        'opacity-60',
      );
      expect(screen.getByRole('menuitemcheckbox', { name: /class c/i }).className).toContain(
        'opacity-60',
      );
    });

    it('does not dim sub-rows when include-hidden is on', () => {
      useSearchMock.mockReturnValue(makeSearch({ airspaceClasses: [], searchIncludeHidden: true }));
      render(<SearchFilterMenu />);
      expandLayer('airspace');

      expect(screen.getByRole('menuitemcheckbox', { name: /class c/i }).className).not.toContain(
        'opacity-60',
      );
    });

    it('keeps a dimmed parent row toggleable so search intent still persists', () => {
      useSearchMock.mockReturnValue(
        makeSearch({ layers: ['airports', 'fixes', 'airways', 'airspace'] }),
      );
      render(<SearchFilterMenu />);
      expect(getParentRow('navaids').className).toContain('opacity-60');

      clickParentLayer('navaids');
      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(makePrev());
      expect(next.searchLayers).toEqual(['airports', 'fixes', 'airways', 'airspace']);
    });
  });

  describe('reset to defaults', () => {
    /** Resolves the reset action row. */
    function getResetRow(): HTMLElement {
      return screen.getByRole('menuitem', { name: /reset to defaults/i });
    }

    it('disables the reset row and ignores clicks when the filter is already at defaults', () => {
      // The all-on `makeSearch()` default (every layer and class searchable,
      // ARTCC included, include-hidden off) is exactly the search-filter default.
      render(<SearchFilterMenu />);

      const reset = getResetRow();
      expect(reset).toHaveAttribute('aria-disabled', 'true');

      fireEvent.click(reset);
      expect(navigateMock).not.toHaveBeenCalled();
    });

    it('enables the reset row when the searchable layer set is narrowed', () => {
      useSearchMock.mockReturnValue(makeSearch({ searchLayers: ['airports'] }));
      render(<SearchFilterMenu />);

      expect(getResetRow()).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('enables the reset row when include-hidden is on', () => {
      useSearchMock.mockReturnValue(makeSearch({ searchIncludeHidden: true }));
      render(<SearchFilterMenu />);

      expect(getResetRow()).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('restores the search fields to defaults and leaves Layers fields untouched', () => {
      useSearchMock.mockReturnValue(
        makeSearch({
          searchLayers: ['airports'],
          searchAirspaceClasses: ['CLASS_B'],
          searchAirwayCategories: ['LOW'],
          searchIncludeHidden: true,
        }),
      );
      render(<SearchFilterMenu />);
      fireEvent.click(getResetRow());

      expect(navigateMock).toHaveBeenCalledTimes(1);
      const next = applyLatestSearchUpdate(
        makePrev({ layers: ['navaids'], airspaceClasses: ['CLASS_C'], airwayCategories: ['HIGH'] }),
      );

      expect(next.searchLayers).toEqual([...CHART_DEFAULTS.searchLayers]);
      expect(next.searchAirspaceClasses).toEqual([...CHART_DEFAULTS.searchAirspaceClasses]);
      expect(next.searchAirwayCategories).toEqual([...CHART_DEFAULTS.searchAirwayCategories]);
      expect(next.searchIncludeHidden).toBe(false);
      // The reset only writes search-filter fields; Layers-menu fields pass
      // through from `prev` unchanged.
      expect(next.layers).toEqual(['navaids']);
      expect(next.airspaceClasses).toEqual(['CLASS_C']);
      expect(next.airwayCategories).toEqual(['HIGH']);
    });
  });
});
