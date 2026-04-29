import { useResolvedTheme } from './theme-context.ts';

/**
 * Centralized color tokens for chart-mode MapLibre layers.
 *
 * MapLibre `paint` and `layout` properties take literal color strings -
 * they cannot read CSS custom properties at runtime - so chart palette
 * tokens live here as TypeScript constants and reach layer code via
 * the {@link useChartColors} hook. UI chrome (panels, buttons, text)
 * continues to use Tailwind utilities directly with the `dark:` variant;
 * only chart-domain colors flow through this module.
 *
 * Two palettes are defined: one for the light basemap and one for the
 * dark basemap. Layer components call {@link useChartColors} inside
 * their function body and rebuild any `LayerProps` that reference
 * palette values via `useMemo` so a theme switch propagates through
 * MapLibre's declarative `paint` props with no manual `setStyle` plumbing.
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
export interface ChartHighlightColors {
  /** Primary highlight fill / stroke (yellow). */
  primary: string;
  /** Stroke paired with the primary highlight on point symbols. */
  stroke: string;
  /** Lighter outline used for the per-feature focus ring on multi-feature airspace groupings. */
  focusOutline: string;
}

/** Airport circle fill colors keyed by longest-runway tier. */
export interface ChartAirportColors {
  /** Major airport (longest runway >= 8000 ft). */
  major: string;
  /** Minor airport. */
  minor: string;
}

/** Airway line colors keyed by altitude band. */
export interface ChartAirwayColors {
  /** Low-altitude airways (VICTOR / RNAV_T). */
  low: string;
  /** High-altitude airways (JET / RNAV_Q). */
  high: string;
  /** Regional / oceanic airways. */
  regional: string;
}

/**
 * Airspace polygon fill / outline palette keyed by airspace class. Class
 * E variants (E2-E7) all share `classE`, mirroring how sectional charts
 * use a single magenta family for every Class E subtype. `fallback` is
 * the default for any unrecognized future `AirspaceType` value.
 */
export interface ChartAirspaceColors {
  /** Class B terminal airspace. */
  classB: string;
  /** Class C terminal airspace. */
  classC: string;
  /** Class D terminal airspace. */
  classD: string;
  /** Class E surface airspace and all E2-E7 subtypes. */
  classE: string;
  /** Military Operations Area. */
  moa: string;
  /** Restricted area. */
  restricted: string;
  /** Prohibited area. */
  prohibited: string;
  /** Warning area. */
  warning: string;
  /** Alert area. */
  alert: string;
  /** National Security Area. */
  nsa: string;
  /** ARTCC boundary. */
  artcc: string;
  /** Catch-all for unrecognized airspace types. */
  fallback: string;
}

/**
 * Airspace per-feature badge label colors. The badge is the small
 * centroid label ("1", "2", "LOW", "HIGH") that disambiguates polygons
 * inside a multi-feature airspace grouping.
 */
export interface ChartAirspaceBadgeColors {
  /** Badge text color. */
  text: string;
  /** Halo color drawn around badge text for legibility. */
  halo: string;
}

/**
 * Full chart-color palette returned by {@link useChartColors}. Each
 * field carries the same semantic meaning across the light and dark
 * variants; only the underlying hex values change.
 */
export interface ChartColorPalette {
  /** Selection / hover highlight palette shared by every chart layer. */
  highlight: ChartHighlightColors;
  /** Default outline drawn around point symbols (airports, fixes, navaids). */
  symbolStroke: string;
  /** Airport circle fills keyed by runway tier. */
  airport: ChartAirportColors;
  /** Fix point symbol fill. */
  fix: string;
  /** Navaid point symbol fill. */
  navaid: string;
  /** Airway line colors keyed by altitude band. */
  airway: ChartAirwayColors;
  /** Airspace polygon fill / outline palette keyed by class. */
  airspace: ChartAirspaceColors;
  /** Airspace per-feature badge colors. */
  airspaceBadge: ChartAirspaceBadgeColors;
}

/**
 * Light-basemap palette. Tuned against Protomaps' `light` flavor: dark
 * point fills and saturated polygon tints sit cleanly on a near-white
 * tile background, and the white symbol stroke separates colored
 * circles from the basemap.
 */
const LIGHT_PALETTE: ChartColorPalette = {
  highlight: {
    primary: '#fde047',
    stroke: '#0f172a',
    focusOutline: '#fef9c3',
  },
  symbolStroke: '#ffffff',
  airport: {
    major: '#1d4ed8',
    minor: '#0f172a',
  },
  fix: '#ea580c',
  navaid: '#7c3aed',
  airway: {
    low: '#475569',
    high: '#4338ca',
    regional: '#94a3b8',
  },
  airspace: {
    classB: '#1e3a8a',
    classC: '#be185d',
    classD: '#2563eb',
    classE: '#ec4899',
    moa: '#d97706',
    restricted: '#dc2626',
    prohibited: '#991b1b',
    warning: '#f97316',
    alert: '#facc15',
    nsa: '#6b7280',
    artcc: '#94a3b8',
    fallback: '#64748b',
  },
  airspaceBadge: {
    text: '#fef08a',
    halo: '#0f172a',
  },
};

/**
 * Dark-basemap palette. Tuned against Protomaps' `dark` flavor: dark
 * point fills are swapped for light neutrals, deeply-saturated polygon
 * tints are lifted to mid-saturation so the low-alpha fills still tint
 * the dark tiles legibly, and the highlight stroke is light enough to
 * read against a near-black backdrop.
 */
const DARK_PALETTE: ChartColorPalette = {
  highlight: {
    primary: '#fde047',
    stroke: '#cbd5e1',
    focusOutline: '#fef9c3',
  },
  symbolStroke: '#ffffff',
  airport: {
    major: '#3b82f6',
    minor: '#cbd5e1',
  },
  fix: '#fb923c',
  navaid: '#a78bfa',
  airway: {
    low: '#cbd5e1',
    high: '#818cf8',
    regional: '#94a3b8',
  },
  airspace: {
    classB: '#3b82f6',
    classC: '#ec4899',
    classD: '#60a5fa',
    classE: '#f472b6',
    moa: '#fbbf24',
    restricted: '#ef4444',
    prohibited: '#f87171',
    warning: '#fb923c',
    alert: '#fde047',
    nsa: '#9ca3af',
    artcc: '#cbd5e1',
    fallback: '#94a3b8',
  },
  airspaceBadge: {
    text: '#fef08a',
    halo: '#0f172a',
  },
};

/**
 * Returns the chart-color palette matching the resolved theme. Layer
 * components call this inside the function body and rebuild any
 * `LayerProps` that reference palette values via `useMemo` so a theme
 * switch propagates through MapLibre's declarative `paint` props
 * without a manual `setStyle` call.
 *
 * Falls back to the light palette when the surrounding `<ThemeProvider>`
 * is missing (the context default resolves to `'light'`), which keeps
 * isolated component tests render-safe without a wrapper.
 *
 * ```tsx
 * function MyLayer(): ReactElement | null {
 *   const colors = useChartColors();
 *   const layerProps = useMemo<LayerProps>(
 *     () => ({ ..., paint: { 'circle-color': colors.airport.major } }),
 *     [colors],
 *   );
 *   return <Layer {...layerProps} />;
 * }
 * ```
 */
export function useChartColors(): ChartColorPalette {
  const resolved = useResolvedTheme();
  return resolved === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}
