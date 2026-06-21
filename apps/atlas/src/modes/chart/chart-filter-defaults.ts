import { CHART_DEFAULTS } from './url-state.ts';
import type { ChartSearch } from './url-state.ts';

/**
 * Order- and duplicate-insensitive equality for two lists of discrete values.
 * Compares them as sets, so `['a', 'b']` equals `['b', 'a']` and a stale URL
 * carrying a duplicate (`['a', 'a']`) is treated as the single-element set it
 * represents. Used to compare a menu's current URL arrays against the matching
 * `CHART_DEFAULTS` slice without depending on serialization order.
 *
 * @param a - First list of values.
 * @param b - Second list of values.
 * @returns True when both lists contain the same distinct values.
 */
function isSameSet<T>(a: readonly T[], b: readonly T[]): boolean {
  const setA = new Set<T>(a);
  const setB = new Set<T>(b);
  if (setA.size !== setB.size) {
    return false;
  }
  for (const value of setA) {
    if (!setB.has(value)) {
      return false;
    }
  }
  return true;
}

/**
 * Whether the Layers-menu URL fields are all at their `CHART_DEFAULTS` values:
 * every layer enabled, the all-except-ARTCC airspace-class set, and every
 * airway category. Drives the enablement of the Layers menu's reset row, which
 * is inert while this returns true.
 *
 * The airspace check must be a set comparison, not a length comparison: the
 * Layers default omits ARTCC, so an eleven-element set that swaps ARTCC in for
 * another class has the same length as the ten-element default yet is not the
 * default.
 *
 * @param search - The Layers-menu slice of the chart search params.
 * @returns True when `layers`, `airspaceClasses`, and `airwayCategories` all match their defaults.
 */
export function isDefaultLayers(
  search: Pick<ChartSearch, 'layers' | 'airspaceClasses' | 'airwayCategories'>,
): boolean {
  return (
    isSameSet(search.layers, CHART_DEFAULTS.layers) &&
    isSameSet(search.airspaceClasses, CHART_DEFAULTS.airspaceClasses) &&
    isSameSet(search.airwayCategories, CHART_DEFAULTS.airwayCategories)
  );
}

/**
 * Whether the search-filter URL fields are all at their `CHART_DEFAULTS`
 * values: every layer searchable, every airspace class (including ARTCC, unlike
 * the Layers default), every airway category, and include-hidden off. Drives
 * the enablement of the search-filter menu's reset row, which is inert while
 * this returns true.
 *
 * @param search - The search-filter slice of the chart search params.
 * @returns True when `searchLayers`, `searchAirspaceClasses`, `searchAirwayCategories`, and `searchIncludeHidden` all match their defaults.
 */
export function isDefaultSearchFilter(
  search: Pick<
    ChartSearch,
    'searchLayers' | 'searchAirspaceClasses' | 'searchAirwayCategories' | 'searchIncludeHidden'
  >,
): boolean {
  return (
    isSameSet(search.searchLayers, CHART_DEFAULTS.searchLayers) &&
    isSameSet(search.searchAirspaceClasses, CHART_DEFAULTS.searchAirspaceClasses) &&
    isSameSet(search.searchAirwayCategories, CHART_DEFAULTS.searchAirwayCategories) &&
    search.searchIncludeHidden === CHART_DEFAULTS.searchIncludeHidden
  );
}
