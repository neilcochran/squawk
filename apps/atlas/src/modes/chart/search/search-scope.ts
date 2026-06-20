import type { AirspaceType, AirwayType, FacilityType, NavaidType } from '@squawk/types';

import { RENDERED_AIRPORT_FACILITY_TYPES, RENDERED_NAVAID_TYPES } from '../layers/drawable-sets.ts';
import { AIRSPACE_CLASS_TYPES, AIRWAY_CATEGORY_TYPES } from '../url-state.ts';
import type { AirspaceClass, AirwayCategory, LayerId } from '../url-state.ts';

/**
 * A selection of chart layers and their sub-classes. Both the Layers menu
 * state (what the map currently draws) and the search filter state (what the
 * user wants searched) take this shape, so the same expansion logic serves
 * both.
 */
export interface LayerSelection {
  /** Enabled top-level layers. */
  layers: readonly LayerId[];
  /** Enabled airspace classes; consulted only when `airspace` is among {@link LayerSelection.layers}. */
  airspaceClasses: readonly AirspaceClass[];
  /** Enabled airway categories; consulted only when `airways` is among {@link LayerSelection.layers}. */
  airwayCategories: readonly AirwayCategory[];
}

/**
 * The set of feature subtypes currently drawn on the map, derived from the
 * Layers menu selection. Used to tag each search result's `hidden` flag and
 * to gate the search corpus when hidden results are excluded.
 *
 * Visibility here means only "the layer (and sub-class) is enabled in the
 * Layers menu"; it deliberately ignores zoom-level gating, so a result for a
 * fix that is enabled but below its paint zoom is still considered visible.
 */
export interface LayerVisibility {
  /** Whether the airports layer is enabled. */
  airports: boolean;
  /** Whether the navaids layer is enabled. */
  navaids: boolean;
  /** Whether the fixes layer is enabled. */
  fixes: boolean;
  /** Airway types currently drawn (empty when the airways layer is disabled). */
  airwayTypes: ReadonlySet<AirwayType>;
  /** Airspace types currently drawn (empty when the airspace layer is disabled). */
  airspaceTypes: ReadonlySet<AirspaceType>;
}

/**
 * The query scope for a single dataset with chart sub-classes: whether to
 * query it at all, and the subtype filter to pass to its resolver.
 */
export interface KindScope<T extends string> {
  /** Whether the dataset should be queried. False when nothing in it is in scope. */
  enabled: boolean;
  /** Subtype filter forwarded to the resolver's `search`. */
  types: ReadonlySet<T>;
}

/**
 * The fully-resolved scope of a chart search: which datasets to query and,
 * for datasets with chart sub-classes, the subtype filter to apply. Computed
 * by {@link computeSearchScope} from the Layers menu state, the search filter
 * state, and the include-hidden toggle.
 */
export interface SearchScope {
  /** Airport query scope. `types` is always the drawable airport facility set when enabled. */
  airports: KindScope<FacilityType>;
  /** Navaid query scope. `types` is always the drawable navaid type set when enabled. */
  navaids: KindScope<NavaidType>;
  /** Fix query scope. Fixes have no chart sub-classes, so only the enabled flag applies. */
  fixes: { enabled: boolean };
  /** Airway query scope, filtered to the in-scope airway types. */
  airways: KindScope<AirwayType>;
  /** Airspace query scope, filtered to the in-scope airspace types. */
  airspace: KindScope<AirspaceType>;
}

/**
 * Parameters for {@link computeSearchScope}.
 */
export interface SearchScopeParams {
  /** The Layers menu selection: what is currently drawn on the map. */
  layers: LayerSelection;
  /** The search filter selection: which feature types the user wants searched. */
  filter: LayerSelection;
  /**
   * When true, the search ignores the Layers menu and queries the full filter
   * scope, surfacing results for feature types that are currently hidden. When
   * false, the corpus is intersected with what the Layers menu draws.
   */
  includeHidden: boolean;
}

/**
 * Expands a list of airway categories into the underlying airway types they
 * cover, via {@link AIRWAY_CATEGORY_TYPES}.
 */
function expandAirwayCategories(categories: readonly AirwayCategory[]): Set<AirwayType> {
  const types = new Set<AirwayType>();
  for (const category of categories) {
    for (const type of AIRWAY_CATEGORY_TYPES[category]) {
      types.add(type);
    }
  }
  return types;
}

/**
 * Expands a list of airspace classes into the underlying airspace types they
 * cover, via {@link AIRSPACE_CLASS_TYPES}.
 */
function expandAirspaceClasses(classes: readonly AirspaceClass[]): Set<AirspaceType> {
  const types = new Set<AirspaceType>();
  for (const cls of classes) {
    for (const type of AIRSPACE_CLASS_TYPES[cls]) {
      types.add(type);
    }
  }
  return types;
}

/**
 * Computes which feature subtypes are currently drawn on the map from the
 * Layers menu selection. A sub-class set is empty when its top-level layer is
 * disabled, so a disabled airways layer yields no visible airway types even if
 * categories remain checked underneath it.
 *
 * @param selection - The Layers menu selection.
 * @returns The per-dataset visibility, keyed for tagging search results.
 */
export function computeLayerVisibility(selection: LayerSelection): LayerVisibility {
  const enabledLayers = new Set<LayerId>(selection.layers);
  return {
    airports: enabledLayers.has('airports'),
    navaids: enabledLayers.has('navaids'),
    fixes: enabledLayers.has('fixes'),
    airwayTypes: enabledLayers.has('airways')
      ? expandAirwayCategories(selection.airwayCategories)
      : new Set<AirwayType>(),
    airspaceTypes: enabledLayers.has('airspace')
      ? expandAirspaceClasses(selection.airspaceClasses)
      : new Set<AirspaceType>(),
  };
}

/**
 * Restricts a set of in-scope subtypes to those currently visible, unless
 * hidden results are allowed (in which case the full set passes through).
 */
function gateByVisibility<T>(
  inScope: ReadonlySet<T>,
  visible: ReadonlySet<T>,
  includeHidden: boolean,
): Set<T> {
  const result = new Set<T>();
  for (const type of inScope) {
    if (includeHidden || visible.has(type)) {
      result.add(type);
    }
  }
  return result;
}

/**
 * Computes the effective search scope from the Layers menu state, the search
 * filter state, and the include-hidden toggle.
 *
 * A feature type is searched when it is enabled in the search filter AND
 * either hidden results are allowed or the type is currently drawn on the map.
 * The search filter is the user's explicit "what to search" choice; the
 * include-hidden toggle only relaxes the secondary requirement that a type
 * also be visible in the Layers menu.
 *
 * @param params - The Layers selection, filter selection, and include-hidden flag.
 * @returns The per-dataset query scope to drive {@link searchChartFeatures}.
 */
export function computeSearchScope(params: SearchScopeParams): SearchScope {
  const visibility = computeLayerVisibility(params.layers);
  const filterLayers = new Set<LayerId>(params.filter.layers);
  const includeHidden = params.includeHidden;

  const airportsEnabled = filterLayers.has('airports') && (includeHidden || visibility.airports);
  const navaidsEnabled = filterLayers.has('navaids') && (includeHidden || visibility.navaids);
  const fixesEnabled = filterLayers.has('fixes') && (includeHidden || visibility.fixes);

  const airwayTypes = filterLayers.has('airways')
    ? gateByVisibility(
        expandAirwayCategories(params.filter.airwayCategories),
        visibility.airwayTypes,
        includeHidden,
      )
    : new Set<AirwayType>();

  const airspaceTypes = filterLayers.has('airspace')
    ? gateByVisibility(
        expandAirspaceClasses(params.filter.airspaceClasses),
        visibility.airspaceTypes,
        includeHidden,
      )
    : new Set<AirspaceType>();

  return {
    airports: { enabled: airportsEnabled, types: RENDERED_AIRPORT_FACILITY_TYPES },
    navaids: { enabled: navaidsEnabled, types: RENDERED_NAVAID_TYPES },
    fixes: { enabled: fixesEnabled },
    airways: { enabled: airwayTypes.size > 0, types: airwayTypes },
    airspace: { enabled: airspaceTypes.size > 0, types: airspaceTypes },
  };
}
