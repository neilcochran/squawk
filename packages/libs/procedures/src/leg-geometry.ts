/**
 * Drawable geometry extraction for expanded instrument-procedure leg
 * sequences. Walks the ordered {@link ProcedureLeg} array returned by
 * {@link ProcedureResolver.expand} into the subset of legs that terminate at
 * a known fix and exposes that sequence both as plain
 * {@link ProcedureLegPoint} values and as a GeoJSON `LineString` for map
 * rendering.
 *
 * Many ARINC 424 path terminators end at an altitude, DME distance, radial,
 * intercept, or manual event rather than at a fix (for example `CA`, `FA`,
 * `VA`, `CD`, `FD`, `VD`, `CR`, `VR`, `CI`, `VI`, `FM`, `VM`, and the `HA` /
 * `HM` holds). Those legs carry no `lat` / `lon` and therefore contribute no
 * point, so a path drawn through the result is not a precise flyable track:
 * it omits the non-positional legs and breaks across them.
 */

import type { LineString } from 'geojson';

import type { ProcedureLeg } from '@squawk/types';

/**
 * A single drawable geographic point along an expanded procedure, in leg
 * order.
 */
export interface ProcedureLegPoint {
  /** Fix identifier at the leg termination. */
  label: string;
  /** Latitude in decimal degrees, positive north. */
  lat: number;
  /** Longitude in decimal degrees, positive east. */
  lon: number;
}

/** Epsilon for comparing coordinates to detect duplicate points. */
const COORD_EPSILON = 1e-9;

/**
 * Returns true if two points share the same coordinates (within epsilon).
 */
function samePosition(a: ProcedureLegPoint, b: ProcedureLegPoint): boolean {
  return Math.abs(a.lat - b.lat) < COORD_EPSILON && Math.abs(a.lon - b.lon) < COORD_EPSILON;
}

/**
 * Extracts the ordered sequence of drawable geographic points from an
 * expanded procedure leg sequence (the `legs` array of a
 * {@link ProcedureExpansionResult}).
 *
 * Only legs that terminate at a known fix contribute a point: a leg is
 * drawable when it carries a `fixIdentifier`, `lat`, and `lon`. Legs whose
 * path terminator ends at an altitude, DME distance, radial, intercept, or
 * manual event (`CA`, `FA`, `VA`, `CD`, `FD`, `VD`, `CR`, `VR`, `CI`, `VI`,
 * `FM`, `VM`, and the `HA` / `HM` holds) have no coordinate and are skipped.
 * Because a skipped leg leaves a gap, the returned points are not guaranteed
 * to be contiguous: a non-positional leg in the middle of a sequence creates
 * a break in any line drawn through the points, and such legs cannot be
 * rendered from this data alone (they need a flyable geometry computed from
 * the aircraft state, navaid, or altitude).
 *
 * Consecutive duplicate points (within a small epsilon) are suppressed, so a
 * hold or fix repeated back-to-back yields a single point.
 *
 * ```typescript
 * import { createProcedureResolver, extractLegPoints } from '@squawk/procedures';
 *
 * const resolver = createProcedureResolver({ data: procedures });
 * const expansion = resolver.expand('KDEN', 'AALLE4');
 * const points = expansion ? extractLegPoints(expansion.legs) : [];
 * ```
 *
 * @param legs - Ordered procedure legs, e.g. `expand(...).legs`.
 * @returns Ordered drawable points along the procedure.
 */
export function extractLegPoints(legs: ProcedureLeg[]): ProcedureLegPoint[] {
  const points: ProcedureLegPoint[] = [];
  for (const leg of legs) {
    if (leg.fixIdentifier === undefined || leg.lat === undefined || leg.lon === undefined) {
      continue;
    }
    const point: ProcedureLegPoint = { label: leg.fixIdentifier, lat: leg.lat, lon: leg.lon };
    if (points.length > 0 && samePosition(points[points.length - 1]!, point)) {
      continue;
    }
    points.push(point);
  }
  return points;
}

/**
 * Builds a GeoJSON `LineString` from an expanded procedure leg sequence,
 * ready to render as a polyline on a map (e.g. MapLibre, Leaflet).
 *
 * Coordinates follow the GeoJSON `[lon, lat]` ordering. Returns `undefined`
 * when the legs yield fewer than two drawable points, since a `LineString`
 * requires at least two positions to be valid.
 *
 * Non-positional legs are skipped (see {@link extractLegPoints}), so the
 * line connects only the fix-terminated legs in order. When a procedure
 * mixes positional and non-positional legs the line is an approximation that
 * omits the non-drawable segments rather than a precise flyable track.
 *
 * ```typescript
 * import { createProcedureResolver, expansionToLineString } from '@squawk/procedures';
 *
 * const resolver = createProcedureResolver({ data: procedures });
 * const expansion = resolver.expand('KDEN', 'AALLE4');
 * const line = expansion ? expansionToLineString(expansion.legs) : undefined;
 * if (line) {
 *   map.addSource('procedure', { type: 'geojson', data: line });
 * }
 * ```
 *
 * @param legs - Ordered procedure legs, e.g. `expand(...).legs`.
 * @returns A GeoJSON `LineString`, or `undefined` if fewer than two points.
 */
export function expansionToLineString(legs: ProcedureLeg[]): LineString | undefined {
  const points = extractLegPoints(legs);
  if (points.length < 2) {
    return undefined;
  }
  return {
    type: 'LineString',
    coordinates: points.map((p) => [p.lon, p.lat]),
  };
}
