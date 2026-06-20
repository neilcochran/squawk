import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useChartSearch } from './use-chart-search.ts';

const {
  useSearchMock,
  useChartSearchResolversMock,
  computeLayerVisibilityMock,
  computeSearchScopeMock,
  searchChartFeaturesMock,
} = vi.hoisted(() => ({
  useSearchMock: vi.fn(),
  useChartSearchResolversMock: vi.fn(),
  computeLayerVisibilityMock: vi.fn(),
  computeSearchScopeMock: vi.fn(),
  searchChartFeaturesMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: useSearchMock }),
}));
vi.mock('./search-resolvers.ts', () => ({
  useChartSearchResolvers: useChartSearchResolversMock,
}));
vi.mock('./search-scope.ts', () => ({
  computeLayerVisibility: computeLayerVisibilityMock,
  computeSearchScope: computeSearchScopeMock,
}));
vi.mock('./search-features.ts', () => ({
  searchChartFeatures: searchChartFeaturesMock,
}));

const resolversSentinel = { airports: { search: vi.fn() } };
const visibilitySentinel = { visibility: true };
const scopeSentinel = { scope: true };

/** Full chart-search URL state with distinct layer vs search-filter values. */
const search = {
  layers: ['airports', 'navaids'],
  airspaceClasses: ['CLASS_B'],
  airwayCategories: ['LOW'],
  searchLayers: ['airports', 'fixes'],
  searchAirspaceClasses: ['CLASS_C'],
  searchAirwayCategories: ['HIGH'],
  searchIncludeHidden: true,
};

describe('useChartSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchMock.mockReturnValue(search);
    useChartSearchResolversMock.mockReturnValue(resolversSentinel);
    computeLayerVisibilityMock.mockReturnValue(visibilitySentinel);
    computeSearchScopeMock.mockReturnValue(scopeSentinel);
    searchChartFeaturesMock.mockReturnValue([]);
  });

  it('derives visibility from the URL layer state', () => {
    renderHook(() => useChartSearch('BOS'));
    expect(computeLayerVisibilityMock).toHaveBeenCalledWith({
      layers: search.layers,
      airspaceClasses: search.airspaceClasses,
      airwayCategories: search.airwayCategories,
    });
  });

  it('derives scope from the layer state, the search-filter state, and include-hidden', () => {
    renderHook(() => useChartSearch('BOS'));
    expect(computeSearchScopeMock).toHaveBeenCalledWith({
      layers: {
        layers: search.layers,
        airspaceClasses: search.airspaceClasses,
        airwayCategories: search.airwayCategories,
      },
      filter: {
        layers: search.searchLayers,
        airspaceClasses: search.searchAirspaceClasses,
        airwayCategories: search.searchAirwayCategories,
      },
      includeHidden: search.searchIncludeHidden,
    });
  });

  it('returns the merged results for the query, resolvers, scope, and visibility', () => {
    const resultsSentinel = [{ kind: 'airport' }];
    searchChartFeaturesMock.mockReturnValue(resultsSentinel);
    const { result } = renderHook(() => useChartSearch('BOS'));

    expect(result.current).toBe(resultsSentinel);
    expect(searchChartFeaturesMock).toHaveBeenCalledWith({
      text: 'BOS',
      resolvers: resolversSentinel,
      scope: scopeSentinel,
      visibility: visibilitySentinel,
    });
  });

  it('passes a blank query straight through to the search', () => {
    renderHook(() => useChartSearch(''));
    expect(searchChartFeaturesMock).toHaveBeenCalledWith(expect.objectContaining({ text: '' }));
  });
});
