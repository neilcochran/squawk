import type { AirspaceClass, AirwayCategory, LayerId } from './url-state.ts';

/** A single top-level layer option rendered in a layer-selection menu. */
export interface LayerOption {
  /** Stable id matching one of {@link LayerId}. */
  id: LayerId;
  /** User-visible label. */
  label: string;
}

/**
 * Top-level layer rows in display order, shared by the Layers menu and the
 * search filter menu so both expose the same feature types in the same order.
 * Order is independent of the map z-stack (JSX order in chart-mode) and of URL
 * serialization order (which follows the url-state layer id order).
 */
export const LAYER_OPTIONS: readonly LayerOption[] = [
  { id: 'airports', label: 'Airports' },
  { id: 'navaids', label: 'Navaids' },
  { id: 'fixes', label: 'Fixes' },
  { id: 'airways', label: 'Airways' },
  { id: 'airspace', label: 'Airspace' },
];

/** Set of layer ids that have an inline-expandable sub-class list. */
export const EXPANDABLE_LAYERS: ReadonlySet<LayerId> = new Set<LayerId>(['airways', 'airspace']);

/** A single airspace-class row rendered inside an airspace expansion. */
export interface AirspaceClassOption {
  /** Stable id matching one of {@link AirspaceClass}. */
  id: AirspaceClass;
  /** User-visible label. */
  label: string;
}

/** Airspace-class rows in display order: classes first, then special-use, then ARTCC. */
export const AIRSPACE_CLASS_OPTIONS: readonly AirspaceClassOption[] = [
  { id: 'CLASS_B', label: 'Class B' },
  { id: 'CLASS_C', label: 'Class C' },
  { id: 'CLASS_D', label: 'Class D' },
  { id: 'CLASS_E', label: 'Class E' },
  { id: 'MOA', label: 'MOA' },
  { id: 'RESTRICTED', label: 'Restricted' },
  { id: 'PROHIBITED', label: 'Prohibited' },
  { id: 'WARNING', label: 'Warning' },
  { id: 'ALERT', label: 'Alert' },
  { id: 'NSA', label: 'NSA' },
  { id: 'ARTCC', label: 'ARTCC' },
];

/** A single airway-category row rendered inside an airways expansion. */
export interface AirwayCategoryOption {
  /** Stable id matching one of {@link AirwayCategory}. */
  id: AirwayCategory;
  /** User-visible label. */
  label: string;
}

/** Airway-category rows in display order, low to high to oceanic-and-regional. */
export const AIRWAY_CATEGORY_OPTIONS: readonly AirwayCategoryOption[] = [
  { id: 'LOW', label: 'Low altitude' },
  { id: 'HIGH', label: 'High altitude' },
  { id: 'OCEANIC', label: 'Oceanic & regional' },
];
