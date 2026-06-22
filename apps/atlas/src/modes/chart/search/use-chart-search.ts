import { getRouteApi } from '@tanstack/react-router';
import { useDeferredValue, useMemo } from 'react';

import { useAmbiguousPointIdentifiers } from '../../../shared/inspector/entity-resolver.ts';
import { CHART_ROUTE_PATH } from '../url-state.ts';

import { searchChartFeatures } from './search-features.ts';
import type { ChartSearchResult } from './search-features.ts';
import { useChartSearchResolvers } from './search-resolvers.ts';
import { computeLayerVisibility, computeSearchScope } from './search-scope.ts';

const route = getRouteApi(CHART_ROUTE_PATH);

/**
 * Runs the live chart-feature search for the current query against the URL's
 * Layers-menu state and search-filter state.
 *
 * The query is passed through {@link useDeferredValue} so a fast typist keeps a
 * responsive input while the (synchronous, in-memory) fuzzy search runs against
 * the latest settled keystroke. Visibility and scope are derived from the URL
 * so toggling a layer or a search-filter sub-class re-runs the search without
 * the caller threading any of that state through.
 *
 * @param query - Raw search-box text. Blank input yields no results.
 * @returns Score-ranked results, best match first, capped at the merge limit.
 */
export function useChartSearch(query: string): ChartSearchResult[] {
  const {
    layers,
    airspaceClasses,
    airwayCategories,
    searchLayers,
    searchAirspaceClasses,
    searchAirwayCategories,
    searchIncludeHidden,
  } = route.useSearch();
  const resolvers = useChartSearchResolvers();
  const ambiguous = useAmbiguousPointIdentifiers();
  const deferredQuery = useDeferredValue(query);

  const visibility = useMemo(
    () => computeLayerVisibility({ layers, airspaceClasses, airwayCategories }),
    [layers, airspaceClasses, airwayCategories],
  );

  const scope = useMemo(
    () =>
      computeSearchScope({
        layers: { layers, airspaceClasses, airwayCategories },
        filter: {
          layers: searchLayers,
          airspaceClasses: searchAirspaceClasses,
          airwayCategories: searchAirwayCategories,
        },
        includeHidden: searchIncludeHidden,
      }),
    [
      layers,
      airspaceClasses,
      airwayCategories,
      searchLayers,
      searchAirspaceClasses,
      searchAirwayCategories,
      searchIncludeHidden,
    ],
  );

  return useMemo(
    () => searchChartFeatures({ text: deferredQuery, resolvers, scope, visibility, ambiguous }),
    [deferredQuery, resolvers, scope, visibility, ambiguous],
  );
}
