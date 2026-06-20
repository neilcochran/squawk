import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SearchBox } from './search-box.tsx';
import type {
  AirportChartSearchResult,
  AirwayChartSearchResult,
  ChartSearchResult,
  FixChartSearchResult,
  NavaidChartSearchResult,
} from './search-features.ts';

const { useChartSearchMock, useMapMock, getMapInstanceMock, panToMock, fitBoundsMock } = vi.hoisted(
  () => ({
    useChartSearchMock: vi.fn(),
    useMapMock: vi.fn(),
    getMapInstanceMock: vi.fn(),
    panToMock: vi.fn(),
    fitBoundsMock: vi.fn(),
  }),
);

vi.mock('./use-chart-search.ts', () => ({
  useChartSearch: useChartSearchMock,
}));

// SearchBox reaches the live MapLibre instance via `useMap()` to pan the
// camera to a chosen result. Mock the provider hook and the pan helpers so the
// component can mount and select outside a real MapProvider, and so the test
// can assert the pan call without a live map.
vi.mock('@vis.gl/react-maplibre', () => ({
  useMap: useMapMock,
}));

vi.mock('../../../shared/inspector/use-chip-hover-pan.ts', () => ({
  getMapInstance: getMapInstanceMock,
  panToFeatureWithInspectorOffset: panToMock,
  fitFeatureBoundsWithInspectorOffset: fitBoundsMock,
}));

// Stand-in for the underlying MapLibre map instance the framing helpers receive.
// `getZoom` backs the point-result zoom floor; the helpers themselves are
// mocked, so the fake needs nothing else.
const fakeMap = { getZoom: (): number => 4 };

// The filter menu reads/writes route state of its own; the search-box tests
// only care that it renders beside the input, so stub it to an inert node.
vi.mock('./search-filter-menu.tsx', () => ({
  SearchFilterMenu(): null {
    return null;
  },
}));

// Airport matched on its city ("BOSTON"), so the row leads with the matched
// city text and shows the FAA id as the muted secondary line. The match range
// covers only "BOS" so the row has a matched run and an unmatched tail.
const airport: AirportChartSearchResult = {
  kind: 'airport',
  matchedField: 'city',
  selection: 'airport:KBOS',
  label: 'KBOS',
  sublabel: 'Logan Intl',
  matchedText: 'BOSTON',
  ranges: [{ start: 0, end: 3 }],
  score: 0.9,
  center: { lng: -71, lat: 42 },
  hidden: false,
};

// Navaid matched on its identifier, so the row leads with the identifier and
// shows the navaid name as the secondary line.
const navaid: NavaidChartSearchResult = {
  kind: 'navaid',
  subtype: 'VOR',
  matchedField: 'identifier',
  selection: 'navaid:BOS',
  label: 'BOS',
  sublabel: 'Boston VORTAC',
  matchedText: 'BOS',
  ranges: [{ start: 0, end: 3 }],
  score: 0.8,
  center: { lng: -71, lat: 42 },
  hidden: false,
};

// Fix matched on its identifier with no sublabel, so the row has no secondary
// line at all.
const fix: FixChartSearchResult = {
  kind: 'fix',
  matchedField: 'identifier',
  selection: 'fix:MERIT',
  label: 'MERIT',
  sublabel: undefined,
  matchedText: 'MERIT',
  ranges: [{ start: 0, end: 5 }],
  score: 0.7,
  center: { lng: -70, lat: 42 },
  hidden: false,
};

// Airway matched on its designation. Extent features carry a bounding box and
// are framed with fitBounds rather than a point pan, so this fixture stays out
// of the default `fixtures` list (which the point-row rendering tests count on).
const airway: AirwayChartSearchResult = {
  kind: 'airway',
  subtype: 'VICTOR',
  matchedField: 'designation',
  selection: 'airway:V1',
  label: 'V1',
  sublabel: undefined,
  matchedText: 'V1',
  ranges: [{ start: 0, end: 2 }],
  score: 0.6,
  center: { lng: -72, lat: 43 },
  bbox: { minLon: -73, maxLon: -71, minLat: 42, maxLat: 44 },
  hidden: false,
};

const fixtures = [airport, navaid, fix];

// Stable empty-result reference. The real useChartSearch memoizes its return,
// so a blank query yields the same array identity across renders; SearchBox
// relies on that to reset its active row only when the result set truly
// changes. Returning a fresh `[]` per call here would defeat that and loop.
const noResults: ChartSearchResult[] = [];

/** Focuses the search input and types `value` so the dropdown opens. */
function typeQuery(value: string): HTMLElement {
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  return input;
}

/**
 * Returns the option row at `index`, re-querying the live list each call and
 * asserting the row exists so callers receive a non-optional element.
 */
function optionAt(index: number): HTMLElement {
  const option = screen.getAllByRole('option')[index];
  if (option === undefined) {
    throw new Error(`No option at index ${index}`);
  }
  return option;
}

describe('SearchBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChartSearchMock.mockImplementation((query: string) =>
      query.trim().length > 0 ? fixtures : noResults,
    );
    useMapMock.mockReturnValue({ current: { getMap: (): object => fakeMap }, default: undefined });
    getMapInstanceMock.mockReturnValue(fakeMap);
  });

  it('renders the combobox input but no dropdown until the user types', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('runs the live search with the typed query', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('bos');
    expect(useChartSearchMock).toHaveBeenLastCalledWith('bos');
  });

  it('renders one option per result with a feature-kind badge', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('bos');

    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(within(optionAt(0)).getByText('Airport')).toBeInTheDocument();
    expect(within(optionAt(1)).getByText('Navaid')).toBeInTheDocument();
    expect(within(optionAt(2)).getByText('Fix')).toBeInTheDocument();
  });

  it('emphasizes the matched characters and leaves the rest plain', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('bos');

    const airportOption = screen.getByRole('option', { name: /BOSTON/ });
    const matched = within(airportOption).getByText('BOS');
    expect(matched.tagName).toBe('MARK');
    const unmatched = within(airportOption).getByText('TON');
    expect(unmatched.tagName).not.toBe('MARK');
  });

  it('shows the label as a secondary line when the match was on another field', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('bos');

    const airportOption = screen.getByRole('option', { name: /BOSTON/ });
    expect(within(airportOption).getByText('KBOS')).toBeInTheDocument();
  });

  it('falls back to the sublabel when the match was on the label itself', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('bos');

    const navaidOption = screen.getByRole('option', { name: /VORTAC/ });
    expect(within(navaidOption).getByText('Boston VORTAC')).toBeInTheDocument();
  });

  it('shows a no-matches message for a query that yields no results', () => {
    useChartSearchMock.mockReturnValue([]);
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('zzz');

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('No matches found')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('selects the clicked result and clears the query', () => {
    const onSelectResult = vi.fn();
    render(<SearchBox onSelectResult={onSelectResult} />);
    const input = typeQuery('bos');

    fireEvent.click(screen.getByRole('option', { name: /VORTAC/ }));
    expect(onSelectResult).toHaveBeenCalledTimes(1);
    expect(onSelectResult).toHaveBeenCalledWith(navaid);
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('pans a point result to the zoom floor when the view is more zoomed out', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('bos');

    fireEvent.click(screen.getByRole('option', { name: /VORTAC/ }));
    expect(panToMock).toHaveBeenCalledTimes(1);
    // fakeMap.getZoom() returns 4 (CONUS), below the point-result floor, so the
    // pick eases in to the floor zoom rather than staying at the overview scale.
    expect(panToMock).toHaveBeenCalledWith(navaid.center, fakeMap, 10);
  });

  it('keeps the current zoom for a point result when the view is already closer', () => {
    const closeMap = { getZoom: (): number => 14 };
    getMapInstanceMock.mockReturnValue(closeMap);
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('bos');

    fireEvent.click(screen.getByRole('option', { name: /VORTAC/ }));
    // The floor is a `Math.max`, so a user already zoomed past it is left where
    // they are rather than being yanked back out to the floor.
    expect(panToMock).toHaveBeenCalledWith(navaid.center, closeMap, 14);
  });

  it('fits the bounds of an extent result instead of panning to a point', () => {
    useChartSearchMock.mockReturnValue([airway]);
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('v1');

    fireEvent.click(screen.getByRole('option', { name: /V1/ }));
    expect(fitBoundsMock).toHaveBeenCalledTimes(1);
    expect(fitBoundsMock).toHaveBeenCalledWith(airway.bbox, fakeMap);
    expect(panToMock).not.toHaveBeenCalled();
  });

  it('skips the pan but still selects when the map instance is not yet available', () => {
    getMapInstanceMock.mockReturnValue(undefined);
    const onSelectResult = vi.fn();
    render(<SearchBox onSelectResult={onSelectResult} />);
    typeQuery('bos');

    fireEvent.click(screen.getByRole('option', { name: /VORTAC/ }));
    expect(panToMock).not.toHaveBeenCalled();
    expect(onSelectResult).toHaveBeenCalledWith(navaid);
  });

  it('preselects the first result and moves the active row with the arrow keys', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    const input = typeQuery('bos');

    expect(optionAt(0)).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', optionAt(0).id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(optionAt(1)).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(optionAt(0)).toHaveAttribute('aria-selected', 'true');
  });

  it('selects the active result on Enter', () => {
    const onSelectResult = vi.fn();
    render(<SearchBox onSelectResult={onSelectResult} />);
    const input = typeQuery('bos');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectResult).toHaveBeenCalledWith(navaid);
  });

  it('makes the hovered row the active row', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    typeQuery('bos');

    fireEvent.mouseEnter(optionAt(2));
    expect(optionAt(2)).toHaveAttribute('aria-selected', 'true');
  });

  it('clears the query on Escape', () => {
    render(<SearchBox onSelectResult={vi.fn()} />);
    const input = typeQuery('bos');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('clears the query when the clear button is pressed', () => {
    const onSelectResult = vi.fn();
    render(<SearchBox onSelectResult={onSelectResult} />);
    const input = typeQuery('bos');

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    expect(input).toHaveValue('');
    expect(onSelectResult).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
