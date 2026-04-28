/**
 * Centralized color tokens for chart-mode MapLibre layers.
 *
 * MapLibre `paint` and `layout` properties take literal color strings -
 * they cannot read CSS custom properties at runtime - so chart palette
 * tokens live here as a TypeScript module and are imported by each
 * layer file. UI chrome (panels, buttons, text) continues to use
 * Tailwind utilities directly; only chart-domain colors flow through
 * this module.
 *
 * Add a new token here whenever a layer would otherwise inline a hex
 * literal. Reuse an existing token when the color is already named for
 * the same semantic purpose.
 */

/**
 * Selection / hover highlight colors used uniformly across every chart
 * layer (airports, fixes, navaids, airways, airspace). Reusing a single
 * highlight palette keeps the active-feature affordance recognizable
 * regardless of which layer the feature came from.
 */
export const CHART_HIGHLIGHT_COLORS = {
  /** Primary highlight fill / stroke (yellow). */
  primary: '#fde047',
  /** Dark stroke paired with the primary highlight on point symbols. */
  stroke: '#0f172a',
  /** Lighter outline used for the per-feature focus ring on multi-feature airspace groupings. */
  focusOutline: '#fef9c3',
} as const;

/**
 * Default white stroke around point symbols (airports, fixes, navaids).
 * Sits between the symbol fill and the basemap so the marker reads as a
 * coin rather than blending into chart background tiles.
 */
export const CHART_SYMBOL_STROKE = '#ffffff';

/** Airport circle fill colors keyed by longest-runway tier. */
export const CHART_AIRPORT_COLORS = {
  /** Major airport (longest runway >= 8000 ft) - blue. */
  major: '#1d4ed8',
  /** Minor airport - dark slate. */
  minor: '#0f172a',
} as const;

/** Fix (waypoint) point symbol fill color (amber). */
export const CHART_FIX_COLOR = '#ea580c';

/** Navaid point symbol fill color (purple). */
export const CHART_NAVAID_COLOR = '#7c3aed';

/** Airway line colors keyed by altitude band. */
export const CHART_AIRWAY_COLORS = {
  /** Low-altitude airways (VICTOR / RNAV_T) - slate. */
  low: '#475569',
  /** High-altitude airways (JET / RNAV_Q) - indigo. */
  high: '#4338ca',
  /** Regional / oceanic airways - muted slate. */
  regional: '#94a3b8',
} as const;

/**
 * Airspace polygon fill / outline palette keyed by airspace class. Class
 * E variants (E2-E7) all share `classE`, mirroring how sectional charts
 * use a single magenta family for every Class E subtype. `fallback` is
 * the default for any unrecognized future `AirspaceType` value.
 */
export const CHART_AIRSPACE_COLORS = {
  /** Class B terminal airspace (blue-900). */
  classB: '#1e3a8a',
  /** Class C terminal airspace (rose-900). */
  classC: '#be185d',
  /** Class D terminal airspace (blue-600). */
  classD: '#2563eb',
  /** Class E surface airspace and all E2-E7 subtypes (pink-600). */
  classE: '#ec4899',
  /** Military Operations Area (amber-600). */
  moa: '#d97706',
  /** Restricted area (red-600). */
  restricted: '#dc2626',
  /** Prohibited area (red-900). */
  prohibited: '#991b1b',
  /** Warning area (orange-600). */
  warning: '#f97316',
  /** Alert area (yellow-400). */
  alert: '#facc15',
  /** National Security Area (gray-500). */
  nsa: '#6b7280',
  /** ARTCC boundary (slate-400). */
  artcc: '#94a3b8',
  /** Catch-all for unrecognized airspace types (slate-500). */
  fallback: '#64748b',
} as const;

/**
 * Airspace per-feature badge label colors. The badge is the small
 * centroid label ("1", "2", "LOW", "HIGH") that disambiguates polygons
 * inside a multi-feature airspace grouping.
 */
export const CHART_AIRSPACE_BADGE_COLORS = {
  /** Badge text color (light yellow). */
  text: '#fef08a',
  /** Halo color drawn around badge text for legibility against any basemap or fill. */
  halo: '#0f172a',
} as const;
