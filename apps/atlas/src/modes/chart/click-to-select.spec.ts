import { describe, it, expect } from 'vitest';
import { formatChipLabel, pickFeatureByPriority, selectedFromFeature } from './click-to-select.ts';
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
