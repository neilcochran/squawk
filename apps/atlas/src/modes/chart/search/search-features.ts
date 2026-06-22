import type { AirportResolver, AirportSearchField, AirportSearchResult } from '@squawk/airports';
import type { AirspaceResolver, AirspaceSearchField, AirspaceSearchResult } from '@squawk/airspace';
import type { AirwayResolver, AirwaySearchField, AirwaySearchResult } from '@squawk/airways';
import type { FixResolver, FixSearchField, FixSearchResult } from '@squawk/fixes';
import { polygonGeoJson } from '@squawk/geo';
import type { NavaidResolver, NavaidSearchField, NavaidSearchResult } from '@squawk/navaids';
import type { MatchRange } from '@squawk/search';
import type { Airport, AirspaceFeature, AirspaceType, AirwayType, NavaidType } from '@squawk/types';

import { encodePointId, encodeSelected } from '../../../shared/inspector/entity.ts';
import type { AmbiguousPointIdentifiers, PointPosition } from '../../../shared/inspector/entity.ts';
import {
  bboxFromCoords,
  bboxFromWaypoints,
  coordsOfPolygon,
} from '../../../shared/inspector/geometry.ts';
import type { BoundingBox } from '../../../shared/inspector/geometry.ts';
import { formatAirspaceLabel } from '../interaction/click-to-select.ts';
import { isDrawableNavaid } from '../layers/drawable-sets.ts';

import type { LayerVisibility, SearchScope } from './search-scope.ts';

/**
 * Discriminator for the kind of chart feature a {@link ChartSearchResult}
 * describes. Mirrors the inspector's entity-type literals so a result's
 * `kind` can drive both the row badge and the downstream layer-reveal logic.
 */
export type SearchFeatureKind = 'airport' | 'navaid' | 'fix' | 'airway' | 'airspace';

/**
 * Fields shared by every {@link ChartSearchResult} variant, independent of
 * feature kind. The per-kind variants add their typed `kind` discriminator,
 * `matchedField`, and (for kinds with chart sub-classes) a `subtype`.
 */
export interface ChartSearchResultBase {
  /**
   * URL `selected` value that pins this result in the inspector, in the
   * `{type}:{id}` form produced by {@link encodeSelected}. Round-trips through
   * the inspector's entity resolver, so choosing a result and writing this to
   * the URL resolves the same feature.
   */
  selection: string;
  /** Primary display text for the result row (e.g. an FAA id or designation). */
  label: string;
  /** Secondary display text (e.g. a facility name), or undefined when the kind has none. */
  sublabel: string | undefined;
  /** Text of the field that produced the match, that {@link ChartSearchResultBase.ranges} index into. */
  matchedText: string;
  /** Matched character ranges within {@link ChartSearchResultBase.matchedText}, for highlighting. */
  ranges: MatchRange[];
  /** Fuzzy match strength in `[0, 1]`, where 1 is an exact match. Used to merge-sort across kinds. */
  score: number;
  /** Geographic point to center the camera on when this result is chosen, in MapLibre `{ lng, lat }` form. */
  center: {
    /** Longitude in decimal degrees (WGS84). */
    lng: number;
    /** Latitude in decimal degrees (WGS84). */
    lat: number;
  };
  /**
   * Whether this result's feature type is currently absent from the Layers
   * menu (i.e. not drawn on the map). Always false unless the search ran with
   * hidden results included; lets the UI flag and the selection flow reveal
   * the owning layer.
   */
  hidden: boolean;
}

/**
 * A scored airport search result.
 */
export interface AirportChartSearchResult extends ChartSearchResultBase {
  /** Discriminator: airport result. */
  kind: 'airport';
  /** Which airport field produced the best match. */
  matchedField: AirportSearchField;
}

/**
 * A scored navaid search result, carrying the navaid's type for badge display.
 */
export interface NavaidChartSearchResult extends ChartSearchResultBase {
  /** Discriminator: navaid result. */
  kind: 'navaid';
  /** The matched navaid's type (e.g. `'VOR'`, `'NDB'`), for badge display. */
  subtype: NavaidType;
  /** Which navaid field produced the best match. */
  matchedField: NavaidSearchField;
}

/**
 * A scored fix search result.
 */
export interface FixChartSearchResult extends ChartSearchResultBase {
  /** Discriminator: fix result. */
  kind: 'fix';
  /** Which fix field produced the best match (always the identifier). */
  matchedField: FixSearchField;
}

/**
 * A scored airway search result, carrying the airway's type for badge display.
 */
export interface AirwayChartSearchResult extends ChartSearchResultBase {
  /** Discriminator: airway result. */
  kind: 'airway';
  /** The matched airway's type (e.g. `'VICTOR'`, `'JET'`), for badge display. */
  subtype: AirwayType;
  /** Which airway field produced the best match (always the designation). */
  matchedField: AirwaySearchField;
  /** Bounding box of the airway's waypoints, used to fit the camera on selection. */
  bbox: BoundingBox;
}

/**
 * A scored airspace search result, carrying the airspace's type for badge display.
 */
export interface AirspaceChartSearchResult extends ChartSearchResultBase {
  /** Discriminator: airspace result. */
  kind: 'airspace';
  /** The matched feature's airspace type (e.g. `'CLASS_B'`, `'MOA'`), for badge display. */
  subtype: AirspaceType;
  /** Which airspace field produced the best match. */
  matchedField: AirspaceSearchField;
  /** Bounding box of the airspace's boundary, used to fit the camera on selection. */
  bbox: BoundingBox;
}

/**
 * A single scored result from {@link searchChartFeatures}, discriminated by
 * `kind`. Each variant carries everything the results dropdown needs to render
 * a row (label, sublabel, highlight ranges, badge) and everything the
 * selection flow needs to act on it (URL selection, camera center, hidden flag).
 */
export type ChartSearchResult =
  | AirportChartSearchResult
  | NavaidChartSearchResult
  | FixChartSearchResult
  | AirwayChartSearchResult
  | AirspaceChartSearchResult;

/**
 * The minimal resolver surface {@link searchChartFeatures} depends on: just the
 * `search` method of each chart dataset resolver. Narrowed via `Pick` so test
 * fakes only need to implement `search`, not the full lookup surface.
 */
export interface ChartSearchResolvers {
  /** Airport resolver, queried when {@link SearchScope.airports} is enabled. */
  airports: Pick<AirportResolver, 'search'>;
  /** Navaid resolver, queried when {@link SearchScope.navaids} is enabled. */
  navaids: Pick<NavaidResolver, 'search'>;
  /** Fix resolver, queried when {@link SearchScope.fixes} is enabled. */
  fixes: Pick<FixResolver, 'search'>;
  /** Airway resolver, queried when {@link SearchScope.airways} is enabled. */
  airways: Pick<AirwayResolver, 'search'>;
  /** Airspace resolver, queried when {@link SearchScope.airspace} is enabled. */
  airspace: Pick<AirspaceResolver, 'search'>;
}

/**
 * Parameters for {@link searchChartFeatures}.
 */
export interface ChartSearchParams {
  /** Raw search text. Trimmed internally; a blank query yields no results. */
  text: string;
  /** The dataset resolvers to query. */
  resolvers: ChartSearchResolvers;
  /** Which datasets to query and the subtype filter for each, from `computeSearchScope`. */
  scope: SearchScope;
  /** Per-dataset Layers-menu visibility, used to tag each result's `hidden` flag. */
  visibility: LayerVisibility;
  /** Maximum number of merged results to return. Defaults to {@link DEFAULT_RESULT_LIMIT}. */
  limit?: number;
  /** Minimum match score (exclusive) forwarded to each resolver. When omitted, every match is kept. */
  minScore?: number;
  /**
   * Shared navaid / fix identifier sets. When a result's identifier is
   * present, its selection gains a `/c:LON,LAT` suffix so choosing the row
   * resolves the intended record rather than the first identifier match.
   * Omit to encode every result bare.
   */
  ambiguous?: AmbiguousPointIdentifiers;
}

/**
 * Default maximum number of merged results returned by
 * {@link searchChartFeatures}.
 */
export const DEFAULT_RESULT_LIMIT = 20;

/**
 * Resolves the matched-field text for an airport result so the highlight
 * ranges line up with the field the fuzzy matcher scored against.
 */
function airportMatchedText(airport: Airport, field: AirportSearchField): string {
  switch (field) {
    case 'faaId':
      return airport.faaId;
    case 'icao':
      return airport.icao ?? '';
    case 'name':
      return airport.name;
    case 'city':
      return airport.city;
  }
}

/**
 * Builds an airport result row from a resolver match.
 */
function buildAirportResult(
  match: AirportSearchResult,
  visibility: LayerVisibility,
): AirportChartSearchResult {
  const airport = match.airport;
  return {
    kind: 'airport',
    selection: encodeSelected({ type: 'airport', id: airport.faaId }),
    label: airport.faaId,
    sublabel: airport.name,
    matchedField: match.matchedField,
    matchedText: airportMatchedText(airport, match.matchedField),
    ranges: match.ranges,
    score: match.score,
    center: { lng: airport.lon, lat: airport.lat },
    hidden: !visibility.airports,
  };
}

/**
 * Returns the disambiguating position for a shared point-feature
 * identifier, or undefined when the identifier is unique (so the
 * selection encodes bare). The coordinates come straight from the
 * matched record, so unlike the click path there is no tile-quantized
 * geometry to contend with.
 *
 * @param identifier - The matched record's identifier.
 * @param lat - The record latitude in decimal degrees (WGS84).
 * @param lon - The record longitude in decimal degrees (WGS84).
 * @param ambiguousSet - Identifiers shared by 2+ records, or undefined to disable suffixing.
 * @returns The disambiguating position, or undefined to encode the bare identifier.
 */
function positionForSharedIdentifier(
  identifier: string,
  lat: number,
  lon: number,
  ambiguousSet: ReadonlySet<string> | undefined,
): PointPosition | undefined {
  if (ambiguousSet === undefined || !ambiguousSet.has(identifier)) {
    return undefined;
  }
  return { lat, lon };
}

/**
 * Builds a navaid result row from a resolver match.
 */
function buildNavaidResult(
  match: NavaidSearchResult,
  visibility: LayerVisibility,
  ambiguousNavaids: ReadonlySet<string> | undefined,
): NavaidChartSearchResult {
  const navaid = match.navaid;
  const position = positionForSharedIdentifier(
    navaid.identifier,
    navaid.lat,
    navaid.lon,
    ambiguousNavaids,
  );
  return {
    kind: 'navaid',
    selection: encodeSelected({ type: 'navaid', id: encodePointId(navaid.identifier, position) }),
    label: navaid.identifier,
    sublabel: navaid.name,
    subtype: navaid.type,
    matchedField: match.matchedField,
    matchedText: match.matchedField === 'identifier' ? navaid.identifier : navaid.name,
    ranges: match.ranges,
    score: match.score,
    center: { lng: navaid.lon, lat: navaid.lat },
    hidden: !visibility.navaids,
  };
}

/**
 * Builds a fix result row from a resolver match.
 */
function buildFixResult(
  match: FixSearchResult,
  visibility: LayerVisibility,
  ambiguousFixes: ReadonlySet<string> | undefined,
): FixChartSearchResult {
  const fix = match.fix;
  const position = positionForSharedIdentifier(fix.identifier, fix.lat, fix.lon, ambiguousFixes);
  return {
    kind: 'fix',
    selection: encodeSelected({ type: 'fix', id: encodePointId(fix.identifier, position) }),
    label: fix.identifier,
    sublabel: undefined,
    matchedField: match.matchedField,
    matchedText: fix.identifier,
    ranges: match.ranges,
    score: match.score,
    center: { lng: fix.lon, lat: fix.lat },
    hidden: !visibility.fixes,
  };
}

/**
 * Builds an airway result row from a resolver match. Returns undefined when the
 * airway has no waypoints to derive a camera center from, so the result is
 * dropped rather than carrying an unusable center.
 */
function buildAirwayResult(
  match: AirwaySearchResult,
  visibility: LayerVisibility,
): AirwayChartSearchResult | undefined {
  const airway = match.airway;
  const bbox = bboxFromWaypoints(airway.waypoints);
  if (bbox === undefined) {
    return undefined;
  }
  return {
    kind: 'airway',
    selection: encodeSelected({ type: 'airway', id: airway.designation }),
    label: airway.designation,
    sublabel: undefined,
    subtype: airway.type,
    matchedField: match.matchedField,
    matchedText: airway.designation,
    ranges: match.ranges,
    score: match.score,
    center: { lng: (bbox.minLon + bbox.maxLon) / 2, lat: (bbox.minLat + bbox.maxLat) / 2 },
    bbox,
    hidden: !visibility.airwayTypes.has(airway.type),
  };
}

/**
 * Encodes the URL selection for an airspace feature. Non-empty identifiers use
 * the `{type}/{identifier}` form; empty identifiers (some Class E5 surfaces)
 * fall back to the centroid encoding `{type}/c:{lon},{lat}`, matching the
 * click-path encoding so the inspector's `byCentroid` lookup resolves it.
 */
function airspaceSelection(feature: AirspaceFeature, centroid: readonly [number, number]): string {
  if (feature.identifier !== '') {
    return encodeSelected({ type: 'airspace', id: `${feature.type}/${feature.identifier}` });
  }
  const lon = centroid[0].toFixed(5);
  const lat = centroid[1].toFixed(5);
  return encodeSelected({ type: 'airspace', id: `${feature.type}/c:${lon},${lat}` });
}

/**
 * Builds an airspace result row from a resolver match. Returns undefined when
 * the feature's polygon has no computable centroid or bounding box, since the
 * centroid backs both the camera center and the empty-identifier selection key
 * and the bounding box frames the camera on selection.
 */
function buildAirspaceResult(
  match: AirspaceSearchResult,
  visibility: LayerVisibility,
): AirspaceChartSearchResult | undefined {
  const feature = match.feature;
  const centroid = polygonGeoJson.polygonCentroid(feature.boundary);
  if (centroid === undefined) {
    return undefined;
  }
  const bbox = bboxFromCoords(coordsOfPolygon(feature.boundary));
  if (bbox === undefined) {
    return undefined;
  }
  return {
    kind: 'airspace',
    selection: airspaceSelection(feature, centroid),
    label: formatAirspaceLabel(feature.type, feature.identifier, feature.name),
    sublabel: undefined,
    subtype: feature.type,
    matchedField: match.matchedField,
    matchedText: match.matchedField === 'identifier' ? feature.identifier : feature.name,
    ranges: match.ranges,
    score: match.score,
    center: { lng: centroid[0], lat: centroid[1] },
    bbox,
    hidden: !visibility.airspaceTypes.has(feature.type),
  };
}

/**
 * Runs a fuzzy chart-feature search across every in-scope dataset and merges
 * the results into a single score-ranked list.
 *
 * Each enabled dataset (per {@link ChartSearchParams.scope}) is queried with
 * the trimmed text and its subtype filter. Navaid matches are post-filtered to
 * the drawable corpus via {@link isDrawableNavaid} so shutdown facilities never
 * surface. Airway and airspace matches that lack usable geometry (no waypoints,
 * no polygon centroid) are dropped. The merged results are sorted by descending
 * score and truncated to the limit.
 *
 * @param params - Search text, resolvers, scope, visibility, and limits.
 * @returns Score-ranked results, best match first, capped at the limit.
 */
export function searchChartFeatures(params: ChartSearchParams): ChartSearchResult[] {
  const text = params.text.trim();
  if (text.length === 0) {
    return [];
  }

  const { resolvers, scope, visibility } = params;
  const limit = params.limit ?? DEFAULT_RESULT_LIMIT;
  const minScore = params.minScore;
  const results: ChartSearchResult[] = [];

  if (scope.airports.enabled) {
    const matches = resolvers.airports.search({
      text,
      types: scope.airports.types,
      limit,
      ...(minScore !== undefined && { minScore }),
    });
    for (const match of matches) {
      results.push(buildAirportResult(match, visibility));
    }
  }

  if (scope.navaids.enabled) {
    const matches = resolvers.navaids.search({
      text,
      types: scope.navaids.types,
      limit,
      ...(minScore !== undefined && { minScore }),
    });
    for (const match of matches) {
      if (!isDrawableNavaid(match.navaid)) {
        continue;
      }
      results.push(buildNavaidResult(match, visibility, params.ambiguous?.navaids));
    }
  }

  if (scope.fixes.enabled) {
    const matches = resolvers.fixes.search({
      text,
      limit,
      ...(minScore !== undefined && { minScore }),
    });
    for (const match of matches) {
      results.push(buildFixResult(match, visibility, params.ambiguous?.fixes));
    }
  }

  if (scope.airways.enabled) {
    const matches = resolvers.airways.search({
      text,
      types: scope.airways.types,
      limit,
      ...(minScore !== undefined && { minScore }),
    });
    for (const match of matches) {
      const result = buildAirwayResult(match, visibility);
      if (result !== undefined) {
        results.push(result);
      }
    }
  }

  if (scope.airspace.enabled) {
    const matches = resolvers.airspace.search({
      text,
      types: scope.airspace.types,
      limit,
      ...(minScore !== undefined && { minScore }),
    });
    for (const match of matches) {
      const result = buildAirspaceResult(match, visibility);
      if (result !== undefined) {
        results.push(result);
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
