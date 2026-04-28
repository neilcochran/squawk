import { describe, it, expect } from 'vitest';
import {
  classifyClick,
  formatChipLabel,
  pickFeatureByPriority,
  selectedFromFeature,
} from './click-to-select.ts';
import type { InspectableFeature } from './click-to-select.ts';
import { AIRPORTS_LAYER_ID } from './layers/airports-layer.tsx';
import { AIRSPACE_FILL_LAYER_ID, AIRSPACE_LINE_LAYER_ID } from './layers/airspace-layer.tsx';
import { AIRWAYS_LAYER_ID } from './layers/airways-layer.tsx';
import { FIXES_LAYER_ID } from './layers/fixes-layer.tsx';
import { NAVAIDS_LAYER_ID } from './layers/navaids-layer.tsx';

/**
 * Builds the minimal `InspectableFeature` shape `selectedFromFeature`
 * reads. The encode function only touches `layer.id` and `properties`, so
 * the InspectableFeature interface narrows the parameter to exactly that;
 * no MapLibre type assertion needed.
 */
function buildFeature(layerId: string, properties: Record<string, unknown>): InspectableFeature {
  return { layer: { id: layerId }, properties };
}

describe('selectedFromFeature', () => {
  it('encodes an airport feature using its faaId', () => {
    expect(selectedFromFeature(buildFeature(AIRPORTS_LAYER_ID, { faaId: 'BOS' }))).toBe(
      'airport:BOS',
    );
  });

  it('encodes a navaid feature using its identifier', () => {
    expect(selectedFromFeature(buildFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' }))).toBe(
      'navaid:BOS',
    );
  });

  it('encodes a fix feature using its identifier', () => {
    expect(selectedFromFeature(buildFeature(FIXES_LAYER_ID, { identifier: 'MERIT' }))).toBe(
      'fix:MERIT',
    );
  });

  it('encodes an airway feature using its designation', () => {
    expect(selectedFromFeature(buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' }))).toBe(
      'airway:V16',
    );
  });

  it('encodes an airspace fill feature using type/identifier', () => {
    expect(
      selectedFromFeature(
        buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' }),
      ),
    ).toBe('airspace:CLASS_B/JFK');
  });

  it('encodes an airspace line feature the same way as a fill feature', () => {
    expect(
      selectedFromFeature(
        buildFeature(AIRSPACE_LINE_LAYER_ID, { type: 'ARTCC', identifier: 'ZNY' }),
      ),
    ).toBe('airspace:ARTCC/ZNY');
  });

  it('returns undefined when an airport feature is missing faaId', () => {
    expect(selectedFromFeature(buildFeature(AIRPORTS_LAYER_ID, {}))).toBeUndefined();
  });

  it('returns undefined when an airspace feature is missing identifier', () => {
    expect(
      selectedFromFeature(buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B' })),
    ).toBeUndefined();
  });

  it('returns undefined for a feature from an unknown layer', () => {
    expect(
      selectedFromFeature(buildFeature('atlas-some-other-layer', { faaId: 'BOS' })),
    ).toBeUndefined();
  });

  it('returns undefined when a property is the wrong type', () => {
    expect(selectedFromFeature(buildFeature(AIRPORTS_LAYER_ID, { faaId: 12345 }))).toBeUndefined();
  });

  it('returns undefined for an empty-identifier airspace without geometry', () => {
    // The empty-identifier path needs a polygon centroid as a stable URL
    // disambiguator; without geometry there is no centroid to encode and
    // the click is non-shareable.
    expect(
      selectedFromFeature(
        buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_E5', identifier: '' }),
      ),
    ).toBeUndefined();
  });

  it('encodes an empty-identifier airspace using its polygon centroid', () => {
    const feature: InspectableFeature = {
      layer: { id: AIRSPACE_FILL_LAYER_ID },
      properties: { type: 'CLASS_E5', identifier: '' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-107.5, 45.0],
            [-107.5, 45.5],
            [-107.0, 45.5],
            [-107.0, 45.0],
            [-107.5, 45.0],
          ],
        ],
      },
    };
    // Centroid: mean lon = -107.3 (5 coords summing to -536.5), mean lat
    // = 45.2 (sum = 226). Round to 5dp.
    expect(selectedFromFeature(feature)).toBe('airspace:CLASS_E5/c:-107.30000,45.20000');
  });

  it('prefers the projected match-key over the recomputed geometry centroid for empty-identifier airspace', () => {
    // The projection in `airspace-layer.tsx` attaches a match-key built
    // from the SOURCE polygon's centroid. MapLibre's queryRenderedFeatures
    // returns tile-clipped geometry, so recomputing the centroid here
    // would drift outside the resolver's tolerance. Reading the match-key
    // sidesteps the drift entirely. This test pins the behavior: even when
    // the geometry centroid would be one value, the projected match-key
    // wins.
    const feature: InspectableFeature = {
      layer: { id: AIRSPACE_FILL_LAYER_ID },
      properties: {
        type: 'CLASS_E5',
        identifier: '',
        // Pre-projected match-key whose centroid coords differ from the
        // geometry centroid below; the encoded selection should reflect
        // the match-key, not the geometry.
        __atlasMatchKey: 'CLASS_E5/c:-96.53906,38.10237',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-107.5, 45.0],
            [-107.5, 45.5],
            [-107.0, 45.5],
            [-107.0, 45.0],
            [-107.5, 45.0],
          ],
        ],
      },
    };
    expect(selectedFromFeature(feature)).toBe('airspace:CLASS_E5/c:-96.53906,38.10237');
  });
});

describe('pickFeatureByPriority', () => {
  it('returns undefined for an empty feature list', () => {
    expect(pickFeatureByPriority([])).toBeUndefined();
  });

  it('returns the only feature when the list has one entry', () => {
    const feature = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    expect(pickFeatureByPriority([feature])).toBe(feature);
  });

  it('prefers an airport over an airspace at the same point', () => {
    const airport = buildFeature(AIRPORTS_LAYER_ID, { faaId: 'BOS' });
    const airspace = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'CLASS_B',
      identifier: 'BOS',
    });
    expect(pickFeatureByPriority([airspace, airport])).toBe(airport);
  });

  it('prefers a navaid over an airway and airspace', () => {
    const airspace = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'CLASS_E5',
      identifier: 'X',
    });
    const airway = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const navaid = buildFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' });
    expect(pickFeatureByPriority([airspace, airway, navaid])).toBe(navaid);
  });

  it('prefers an airway over both airspace fill and outline', () => {
    const fill = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_E5', identifier: 'X' });
    const line = buildFeature(AIRSPACE_LINE_LAYER_ID, { type: 'CLASS_E5', identifier: 'X' });
    const airway = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    expect(pickFeatureByPriority([fill, line, airway])).toBe(airway);
  });

  it('treats airspace fill and line as equal priority (first-seen wins)', () => {
    const fill = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    const line = buildFeature(AIRSPACE_LINE_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    expect(pickFeatureByPriority([fill, line])).toBe(fill);
    expect(pickFeatureByPriority([line, fill])).toBe(line);
  });

  it('skips features from unknown layers', () => {
    const unknown = buildFeature('atlas-future-layer', { something: 'else' });
    const airspace = buildFeature(AIRSPACE_FILL_LAYER_ID, {
      type: 'CLASS_B',
      identifier: 'JFK',
    });
    expect(pickFeatureByPriority([unknown, airspace])).toBe(airspace);
  });

  it('returns undefined when every feature is from an unknown layer', () => {
    expect(pickFeatureByPriority([buildFeature('atlas-future-layer', {})])).toBeUndefined();
  });
});

describe('formatChipLabel', () => {
  it('labels an airport feature with its faaId', () => {
    expect(formatChipLabel(buildFeature(AIRPORTS_LAYER_ID, { faaId: 'BOS' }))).toBe('BOS');
  });

  it('labels a navaid feature with its identifier', () => {
    expect(formatChipLabel(buildFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' }))).toBe('BOS');
  });

  it('labels a fix feature with its identifier', () => {
    expect(formatChipLabel(buildFeature(FIXES_LAYER_ID, { identifier: 'MERIT' }))).toBe('MERIT');
  });

  it('labels an airway feature with its designation', () => {
    expect(formatChipLabel(buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' }))).toBe('V16');
  });

  it('labels an airspace feature with its friendly type and identifier', () => {
    expect(
      formatChipLabel(buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' })),
    ).toBe('CLASS B JFK');
  });

  it('labels an airspace line feature the same way as a fill feature', () => {
    expect(
      formatChipLabel(buildFeature(AIRSPACE_LINE_LAYER_ID, { type: 'ARTCC', identifier: 'ZNY' })),
    ).toBe('ARTCC ZNY');
  });

  it('falls back to a generic type label when an airport is missing faaId', () => {
    expect(formatChipLabel(buildFeature(AIRPORTS_LAYER_ID, {}))).toBe('Airport');
  });

  it('returns a non-empty label even when an airspace is missing both type and identifier', () => {
    expect(formatChipLabel(buildFeature(AIRSPACE_FILL_LAYER_ID, {}))).toBe('Airspace');
  });
});

describe('classifyClick', () => {
  it('returns empty for an empty feature list', () => {
    expect(classifyClick([])).toEqual({ kind: 'empty' });
  });

  it('returns empty when every feature is from an unknown layer', () => {
    const unknown = buildFeature('atlas-future-layer', { faaId: 'BOS' });
    expect(classifyClick([unknown])).toEqual({ kind: 'empty' });
  });

  it('returns unambiguous for a single inspectable feature', () => {
    const airport = buildFeature(AIRPORTS_LAYER_ID, { faaId: 'BOS' });
    const result = classifyClick([airport]);
    expect(result).toEqual({
      kind: 'unambiguous',
      winner: airport,
      allFeatures: [airport],
    });
  });

  it('returns unambiguous when the top tier holds one feature even if lower tiers stack', () => {
    // Click on KJFK: airport sits at the top tier; the Class B airspace
    // and ARTCC are lower-tier, so the click is unambiguous and the user
    // gets the airport with the rest as sibling chips.
    const airport = buildFeature(AIRPORTS_LAYER_ID, { faaId: 'JFK' });
    const classB = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    const artcc = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'ARTCC', identifier: 'ZNY' });
    const result = classifyClick([airport, classB, artcc]);
    expect(result.kind).toBe('unambiguous');
    if (result.kind === 'unambiguous') {
      expect(result.winner).toBe(airport);
      expect(result.allFeatures).toEqual([airport, classB, artcc]);
    }
  });

  it('returns ambiguous when two airways stack at the top tier', () => {
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    const result = classifyClick([v16, v44]);
    expect(result).toEqual({
      kind: 'ambiguous',
      allFeatures: [v16, v44],
    });
  });

  it('returns ambiguous when two navaids stack at the top tier', () => {
    const a = buildFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' });
    const b = buildFeature(NAVAIDS_LAYER_ID, { identifier: 'PVD' });
    const result = classifyClick([a, b]);
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.allFeatures).toEqual([a, b]);
    }
  });

  it('returns ambiguous when two fixes stack at the top tier', () => {
    const a = buildFeature(FIXES_LAYER_ID, { identifier: 'MERIT' });
    const b = buildFeature(FIXES_LAYER_ID, { identifier: 'BUZRD' });
    const result = classifyClick([a, b]);
    expect(result.kind).toBe('ambiguous');
  });

  it('treats stacked distinct airspaces as ambiguous so the popover can disambiguate them', () => {
    // Three distinct airspaces at the same click. Dense-airspace clicks
    // intentionally pop the popover so the user can pick among them
    // (the highlight is the same shape for any of them once selected,
    // so the popover row is the only place to tell them apart).
    const classB = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    const artcc = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'ARTCC', identifier: 'ZNY' });
    const moaH = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'MOA', identifier: 'MEUREKAH' });
    const result = classifyClick([classB, artcc, moaH]);
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.allFeatures).toEqual([classB, artcc, moaH]);
    }
  });

  it('treats two MOA altitude bands sharing a lateral polygon as ambiguous', () => {
    // The MEUREKAH/MEUREKAL pattern: same lateral polygon, different
    // altitude bands. The map highlight cannot distinguish them, so
    // the popover row's altitude subtitle is the only place where the
    // user sees a difference.
    const high = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'MOA', identifier: 'MEUREKAH' });
    const low = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'MOA', identifier: 'MEUREKAL' });
    const result = classifyClick([high, low]);
    expect(result.kind).toBe('ambiguous');
  });

  it('treats a single airspace fill+line pair as unambiguous (same airspace)', () => {
    // Both features encode to airspace:CLASS_B/JFK, so the dedupe
    // collapses them to one distinct selection.
    const fill = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    const line = buildFeature(AIRSPACE_LINE_LAYER_ID, { type: 'CLASS_B', identifier: 'JFK' });
    const result = classifyClick([fill, line]);
    expect(result.kind).toBe('unambiguous');
    if (result.kind === 'unambiguous') {
      expect(result.winner).toBe(fill);
    }
  });

  it('skips unknown layers when counting the top tier', () => {
    const v16 = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const unknown = buildFeature('atlas-future-layer', {});
    const result = classifyClick([v16, unknown]);
    expect(result.kind).toBe('unambiguous');
    if (result.kind === 'unambiguous') {
      expect(result.winner).toBe(v16);
    }
  });

  it('treats multiple legs of the same airway as one distinct entry (unambiguous)', () => {
    // MapLibre may return several features for the same airway when a
    // bbox query intersects multiple legs; without selection-dedupe
    // the classifier would flag this as ambiguous, the popover would
    // collapse to one row, fail its <2 guard, and the URL would never
    // update - a click that does nothing.
    const v16a = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v16b = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v16c = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const result = classifyClick([v16a, v16b, v16c]);
    expect(result.kind).toBe('unambiguous');
    if (result.kind === 'unambiguous') {
      expect(result.winner).toBe(v16a);
      expect(result.allFeatures).toEqual([v16a, v16b, v16c]);
    }
  });

  it('counts distinct airways when multiple legs of two airways stack', () => {
    // Two distinct airways (V16, V44) each represented by two leg
    // features should still classify as ambiguous - the duplicates
    // collapse but the two distinct selections remain.
    const v16a = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v16b = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const v44a = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    const v44b = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V44' });
    const result = classifyClick([v16a, v16b, v44a, v44b]);
    expect(result.kind).toBe('ambiguous');
  });

  it('preserves MapLibre input order in allFeatures', () => {
    // MapLibre returns features in topmost-rendered order. The chip
    // strip relies on this ordering for the "Also here" list.
    const airport = buildFeature(AIRPORTS_LAYER_ID, { faaId: 'BOS' });
    const airway = buildFeature(AIRWAYS_LAYER_ID, { designation: 'V16' });
    const airspace = buildFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'BOS' });
    const result = classifyClick([airport, airway, airspace]);
    expect(result.kind).toBe('unambiguous');
    if (result.kind === 'unambiguous') {
      expect(result.allFeatures).toEqual([airport, airway, airspace]);
    }
  });
});
