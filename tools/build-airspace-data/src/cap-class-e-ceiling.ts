import type { Polygon } from 'geojson';

import { polygonGeoJson } from '@squawk/geo';
import type { AirspaceFeature, AltitudeBound } from '@squawk/types';

import { UNDEFINED_CEILING_FT } from './normalize-altitude.js';

/**
 * Ceiling attached to a Class E area that lies beneath Class A: 17,999 ft
 * MSL, the last foot below the Class A floor. 14 CFR 71.71 ends the
 * designated Class E areas at the overlying controlled airspace rather than
 * at a number, which is why NASR leaves their upper limit undefined; under
 * Class A that airspace begins at 18,000 ft MSL, and stopping one foot short
 * keeps a query at exactly 18,000 ft from matching both.
 */
export const CLASS_E_CEILING_UNDER_CLASS_A: AltitudeBound = { valueFt: 17999, reference: 'MSL' };

/**
 * Whether a feature is one of the designated Class E areas (E2 through E7).
 * Exported for unit testing.
 */
export function isClassE(feature: AirspaceFeature): boolean {
  return feature.type.startsWith('CLASS_E');
}

/**
 * Whether a feature's ceiling is the sentinel the altitude normalizer emits
 * for an upper limit the source leaves undefined. Exported for unit testing.
 */
export function hasUndefinedCeiling(feature: AirspaceFeature): boolean {
  return feature.ceiling.reference === 'MSL' && feature.ceiling.valueFt === UNDEFINED_CEILING_FT;
}

/**
 * Whether any vertex of `source`'s outer ring lies inside `target`.
 */
function anyVertexInside(source: Polygon, target: Polygon): boolean {
  const outerRing = source.coordinates[0] ?? [];
  for (const position of outerRing) {
    const lon = position[0];
    const lat = position[1];
    if (lon === undefined || lat === undefined) {
      continue;
    }
    if (polygonGeoJson.pointInPolygon([lon, lat], target)) {
      return true;
    }
  }
  return false;
}

/**
 * Tests whether two polygons overlap laterally: their bounding boxes
 * intersect and at least one vertex of either outer ring lies inside the
 * other polygon. The vertex test cannot see two polygons whose edges cross
 * with no vertex of either inside the other, a shape no airport-scale
 * Class E area forms against the ARTCC-scale Class A polygons.
 * Exported for unit testing.
 *
 * @param a - First polygon.
 * @param b - Second polygon.
 * @returns `true` when the polygons share any interior.
 */
export function polygonsOverlap(a: Polygon, b: Polygon): boolean {
  const boxA = polygonGeoJson.polygonBoundingBox(a);
  const boxB = polygonGeoJson.polygonBoundingBox(b);
  if (!polygonGeoJson.boundingBoxesOverlap(boxA, boxB)) {
    return false;
  }
  return anyVertexInside(a, b) || anyVertexInside(b, a);
}

/**
 * Resolves the undefined ceiling of every Class E area that lies beneath
 * Class A to {@link CLASS_E_CEILING_UNDER_CLASS_A}. A Class E feature is
 * capped when its ceiling is the undefined sentinel and its polygon
 * overlaps any Class A polygon. Everything else passes through untouched:
 * Class E areas outside Class A (Hawaii, and beyond the lateral extent of
 * Class A) keep the sentinel because nothing overlies them, a Class E area
 * with a published ceiling keeps it, and the other types are never
 * considered, since Special Use Airspace with an undefined ceiling genuinely
 * extends through Class A.
 *
 * @param features - The parsed Class B/C/D/E features.
 * @param classAFeatures - The derived Class A features.
 * @returns The features in input order, with a capped copy substituted for
 *   each Class E area beneath Class A. Input objects are not mutated.
 */
export function capClassECeilings(
  features: readonly AirspaceFeature[],
  classAFeatures: readonly AirspaceFeature[],
): AirspaceFeature[] {
  const classAShapes = classAFeatures.map((feature) => ({
    polygon: feature.boundary,
    box: polygonGeoJson.polygonBoundingBox(feature.boundary),
  }));
  return features.map((feature) => {
    if (!isClassE(feature) || !hasUndefinedCeiling(feature)) {
      return feature;
    }
    const box = polygonGeoJson.polygonBoundingBox(feature.boundary);
    const underClassA = classAShapes.some(
      (shape) =>
        polygonGeoJson.boundingBoxesOverlap(box, shape.box) &&
        polygonsOverlap(feature.boundary, shape.polygon),
    );
    if (!underClassA) {
      return feature;
    }
    return { ...feature, ceiling: CLASS_E_CEILING_UNDER_CLASS_A };
  });
}
