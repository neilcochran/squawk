import type { Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';

import type { AirspaceFeature, AirspaceType, AltitudeBound } from '@squawk/types';

import {
  CLASS_E_CEILING_UNDER_CLASS_A,
  capClassECeilings,
  hasUndefinedCeiling,
  isClassE,
  polygonsOverlap,
} from './cap-class-e-ceiling.js';

const UNDEFINED_CEILING: AltitudeBound = { valueFt: 99999, reference: 'MSL' };

/** Axis-aligned square with its south-west corner at `(minLon, minLat)`. */
function square(minLon: number, minLat: number, size: number): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [minLon + size, minLat],
        [minLon + size, minLat + size],
        [minLon, minLat + size],
        [minLon, minLat],
      ],
    ],
  };
}

function feature(
  type: AirspaceType,
  boundary: Polygon,
  ceiling: AltitudeBound = UNDEFINED_CEILING,
): AirspaceFeature {
  return {
    type,
    name: type,
    identifier: '',
    floor: { valueFt: 700, reference: 'AGL' },
    ceiling,
    boundary,
    state: null,
    controllingFacility: null,
    scheduleDescription: null,
    artccStratum: null,
  };
}

/** A Class A feature covering lon -100..-90, lat 30..40. */
const classA: AirspaceFeature = {
  ...feature('CLASS_A', square(-100, 30, 10), { valueFt: 60000, reference: 'MSL' }),
  floor: { valueFt: 18000, reference: 'MSL' },
};

describe('isClassE', () => {
  it('accepts every designated Class E subtype', () => {
    for (const type of [
      'CLASS_E2',
      'CLASS_E3',
      'CLASS_E4',
      'CLASS_E5',
      'CLASS_E6',
      'CLASS_E7',
    ] as const) {
      expect(isClassE(feature(type, square(0, 0, 1)))).toBe(true);
    }
  });

  it('rejects every other type', () => {
    for (const type of ['CLASS_A', 'CLASS_B', 'CLASS_D', 'MOA', 'RESTRICTED', 'ARTCC'] as const) {
      expect(isClassE(feature(type, square(0, 0, 1)))).toBe(false);
    }
  });
});

describe('hasUndefinedCeiling', () => {
  it('recognizes the normalizer sentinel', () => {
    expect(hasUndefinedCeiling(feature('CLASS_E5', square(0, 0, 1)))).toBe(true);
  });

  it('rejects a published ceiling', () => {
    const published = feature('CLASS_E2', square(0, 0, 1), { valueFt: 2500, reference: 'MSL' });
    expect(hasUndefinedCeiling(published)).toBe(false);
  });
});

describe('polygonsOverlap', () => {
  it('detects a small polygon inside a large one, in either argument order', () => {
    const small = square(-95, 35, 1);
    expect(polygonsOverlap(small, classA.boundary)).toBe(true);
    expect(polygonsOverlap(classA.boundary, small)).toBe(true);
  });

  it('detects a polygon straddling the edge of another', () => {
    expect(polygonsOverlap(square(-101, 35, 2), classA.boundary)).toBe(true);
  });

  it('rejects disjoint polygons', () => {
    expect(polygonsOverlap(square(-120, 35, 1), classA.boundary)).toBe(false);
  });

  it('rejects polygons whose bounding boxes overlap but whose shapes do not', () => {
    // An L wrapping the south and east sides of a unit square: the boxes
    // intersect, but no vertex of either shape lies inside the other.
    const unitSquare = square(0, 0, 2);
    const wrappingL: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-1, -1],
          [3, -1],
          [3, 3],
          [2.5, 3],
          [2.5, -0.5],
          [-1, -0.5],
          [-1, -1],
        ],
      ],
    };
    expect(polygonsOverlap(unitSquare, wrappingL)).toBe(false);
  });
});

describe('capClassECeilings', () => {
  it('caps an undefined Class E ceiling beneath Class A to 17,999 ft MSL', () => {
    const [capped] = capClassECeilings([feature('CLASS_E5', square(-95, 35, 1))], [classA]);
    expect(capped?.ceiling).toEqual({ valueFt: 17999, reference: 'MSL' });
    expect(capped?.ceiling).toEqual(CLASS_E_CEILING_UNDER_CLASS_A);
  });

  it('caps a Class E area that only partly overlaps Class A', () => {
    const [capped] = capClassECeilings([feature('CLASS_E4', square(-101, 35, 2))], [classA]);
    expect(capped?.ceiling.valueFt).toBe(17999);
  });

  it('leaves a Class E area outside every Class A polygon at the sentinel', () => {
    const hawaii = feature('CLASS_E5', square(-158, 21, 1));
    const [untouched] = capClassECeilings([hawaii], [classA]);
    expect(untouched).toBe(hawaii);
    expect(untouched?.ceiling).toEqual(UNDEFINED_CEILING);
  });

  it('keeps a published Class E ceiling beneath Class A', () => {
    const shelf = feature('CLASS_E2', square(-95, 35, 1), { valueFt: 2500, reference: 'MSL' });
    const [untouched] = capClassECeilings([shelf], [classA]);
    expect(untouched).toBe(shelf);
  });

  it('never touches other types with an undefined ceiling, which extend through Class A', () => {
    const restricted = feature('RESTRICTED', square(-95, 35, 1));
    const classD = feature('CLASS_D', square(-95, 35, 1));
    const result = capClassECeilings([restricted, classD], [classA]);
    expect(result[0]).toBe(restricted);
    expect(result[1]).toBe(classD);
  });

  it('changes nothing when no Class A was derived', () => {
    const area = feature('CLASS_E5', square(-95, 35, 1));
    expect(capClassECeilings([area], [])).toEqual([area]);
  });

  it('preserves order and count and does not mutate the inputs', () => {
    const under = feature('CLASS_E5', square(-95, 35, 1));
    const outside = feature('CLASS_E5', square(-120, 35, 1));
    const classB = feature('CLASS_B', square(-95, 35, 1), { valueFt: 10000, reference: 'MSL' });
    const input = [outside, under, classB];
    const result = capClassECeilings(input, [classA]);
    expect(result.map((f) => f.type)).toEqual(['CLASS_E5', 'CLASS_E5', 'CLASS_B']);
    expect(result[0]).toBe(outside);
    expect(result[1]).not.toBe(under);
    expect(result[1]?.boundary).toBe(under.boundary);
    expect(result[2]).toBe(classB);
    expect(under.ceiling).toEqual(UNDEFINED_CEILING);
  });
});
