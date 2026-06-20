import {
  AIRSPACE_CLASSES,
  AIRSPACE_CLASS_FOR_TYPE,
  AIRWAY_CATEGORIES,
  AIRWAY_CATEGORY_FOR_TYPE,
  LAYER_IDS,
} from '../url-state.ts';
import type { AirspaceClass, AirwayCategory, LayerId } from '../url-state.ts';

import type { ChartSearchResult } from './search-features.ts';
import type { LayerSelection } from './search-scope.ts';

/**
 * Returns `layers` with `id` enabled, preserving the canonical {@link LAYER_IDS}
 * order. Returns the same array reference when `id` is already present, so an
 * already-visible selection produces no layer-state churn.
 */
function withLayer(layers: readonly LayerId[], id: LayerId): readonly LayerId[] {
  if (layers.includes(id)) {
    return layers;
  }
  return LAYER_IDS.filter((layerId) => layers.includes(layerId) || layerId === id);
}

/**
 * Returns `classes` with `cls` enabled, preserving the canonical
 * {@link AIRSPACE_CLASSES} order. Returns the same array reference when `cls`
 * is already present.
 */
function withAirspaceClass(
  classes: readonly AirspaceClass[],
  cls: AirspaceClass,
): readonly AirspaceClass[] {
  if (classes.includes(cls)) {
    return classes;
  }
  return AIRSPACE_CLASSES.filter((c) => classes.includes(c) || c === cls);
}

/**
 * Returns `categories` with `category` enabled, preserving the canonical
 * {@link AIRWAY_CATEGORIES} order. Returns the same array reference when
 * `category` is already present.
 */
function withAirwayCategory(
  categories: readonly AirwayCategory[],
  category: AirwayCategory,
): readonly AirwayCategory[] {
  if (categories.includes(category)) {
    return categories;
  }
  return AIRWAY_CATEGORIES.filter((c) => categories.includes(c) || c === category);
}

/**
 * Computes the Layers-menu selection needed to draw a chosen search result,
 * starting from the current selection and enabling only what is missing.
 *
 * Selecting a result whose feature type is hidden would otherwise pin the
 * inspector to something the map never draws. This ensures the owning
 * top-level layer is on and, for airways and airspace, that the result's
 * category / class is enabled too. Feature types that are already visible pass
 * through untouched (same array identity), so choosing a visible result is a
 * no-op on layer state.
 *
 * @param result - The chosen search result.
 * @param current - The current Layers-menu selection.
 * @returns The next Layers-menu selection with the result's owning layer revealed.
 */
export function revealLayersForResult(
  result: ChartSearchResult,
  current: LayerSelection,
): LayerSelection {
  switch (result.kind) {
    case 'airport':
      return { ...current, layers: withLayer(current.layers, 'airports') };
    case 'navaid':
      return { ...current, layers: withLayer(current.layers, 'navaids') };
    case 'fix':
      return { ...current, layers: withLayer(current.layers, 'fixes') };
    case 'airway':
      return {
        ...current,
        layers: withLayer(current.layers, 'airways'),
        airwayCategories: withAirwayCategory(
          current.airwayCategories,
          AIRWAY_CATEGORY_FOR_TYPE[result.subtype],
        ),
      };
    case 'airspace':
      return {
        ...current,
        layers: withLayer(current.layers, 'airspace'),
        airspaceClasses: withAirspaceClass(
          current.airspaceClasses,
          AIRSPACE_CLASS_FOR_TYPE[result.subtype],
        ),
      };
  }
}
