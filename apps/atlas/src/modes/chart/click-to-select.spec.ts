import { describe, it, expect } from 'vitest';
import { selectedFromFeature } from './click-to-select.ts';
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
});
