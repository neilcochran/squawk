import { describe, expect, it } from 'vitest';

import { MAP_VIEW_DEFAULTS, isDefaultMapView } from './view-state-schema.ts';

describe('isDefaultMapView', () => {
  it('is true for the default view', () => {
    expect(isDefaultMapView({ ...MAP_VIEW_DEFAULTS })).toBe(true);
  });

  it('is false once any field moves', () => {
    expect(isDefaultMapView({ ...MAP_VIEW_DEFAULTS, lat: 40 })).toBe(false);
    expect(isDefaultMapView({ ...MAP_VIEW_DEFAULTS, lon: -100 })).toBe(false);
    expect(isDefaultMapView({ ...MAP_VIEW_DEFAULTS, zoom: 5 })).toBe(false);
    expect(isDefaultMapView({ ...MAP_VIEW_DEFAULTS, pitch: 30 })).toBe(false);
  });
});
