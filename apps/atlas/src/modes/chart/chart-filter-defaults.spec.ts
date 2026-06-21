import { describe, it, expect } from 'vitest';

import { isDefaultLayers, isDefaultSearchFilter } from './chart-filter-defaults.ts';
import { AIRSPACE_CLASSES, AIRWAY_CATEGORIES, CHART_DEFAULTS, LAYER_IDS } from './url-state.ts';
import type { AirspaceClass } from './url-state.ts';

describe('isDefaultLayers', () => {
  it('returns true for the exact CHART_DEFAULTS slice', () => {
    expect(
      isDefaultLayers({
        layers: [...CHART_DEFAULTS.layers],
        airspaceClasses: [...CHART_DEFAULTS.airspaceClasses],
        airwayCategories: [...CHART_DEFAULTS.airwayCategories],
      }),
    ).toBe(true);
  });

  it('ignores ordering when comparing against the defaults', () => {
    expect(
      isDefaultLayers({
        layers: [...CHART_DEFAULTS.layers].reverse(),
        airspaceClasses: [...CHART_DEFAULTS.airspaceClasses].reverse(),
        airwayCategories: [...CHART_DEFAULTS.airwayCategories].reverse(),
      }),
    ).toBe(true);
  });

  it('treats a duplicate-bearing stale URL as the set it represents', () => {
    expect(
      isDefaultLayers({
        layers: [...CHART_DEFAULTS.layers, 'airports'],
        airspaceClasses: [...CHART_DEFAULTS.airspaceClasses],
        airwayCategories: [...CHART_DEFAULTS.airwayCategories],
      }),
    ).toBe(true);
  });

  it('returns false when a layer is removed', () => {
    expect(
      isDefaultLayers({
        layers: LAYER_IDS.filter((id) => id !== 'fixes'),
        airspaceClasses: [...CHART_DEFAULTS.airspaceClasses],
        airwayCategories: [...CHART_DEFAULTS.airwayCategories],
      }),
    ).toBe(false);
  });

  it('returns false when ARTCC is added (the Layers default omits it)', () => {
    expect(
      isDefaultLayers({
        layers: [...CHART_DEFAULTS.layers],
        airspaceClasses: [...AIRSPACE_CLASSES],
        airwayCategories: [...CHART_DEFAULTS.airwayCategories],
      }),
    ).toBe(false);
  });

  it('returns false for a same-length airspace set with different members', () => {
    // Drop CLASS_B, add ARTCC: still ten classes, but not the default ten, so
    // a length-only check would wrongly pass. The set comparison catches it.
    const swapped: AirspaceClass[] = [
      ...CHART_DEFAULTS.airspaceClasses.filter((cls) => cls !== 'CLASS_B'),
      'ARTCC',
    ];
    expect(swapped.length).toBe(CHART_DEFAULTS.airspaceClasses.length);
    expect(
      isDefaultLayers({
        layers: [...CHART_DEFAULTS.layers],
        airspaceClasses: swapped,
        airwayCategories: [...CHART_DEFAULTS.airwayCategories],
      }),
    ).toBe(false);
  });

  it('returns false when airway categories are narrowed', () => {
    expect(
      isDefaultLayers({
        layers: [...CHART_DEFAULTS.layers],
        airspaceClasses: [...CHART_DEFAULTS.airspaceClasses],
        airwayCategories: ['LOW'],
      }),
    ).toBe(false);
  });
});

describe('isDefaultSearchFilter', () => {
  it('returns true for the exact CHART_DEFAULTS slice', () => {
    expect(
      isDefaultSearchFilter({
        searchLayers: [...CHART_DEFAULTS.searchLayers],
        searchAirspaceClasses: [...CHART_DEFAULTS.searchAirspaceClasses],
        searchAirwayCategories: [...CHART_DEFAULTS.searchAirwayCategories],
        searchIncludeHidden: CHART_DEFAULTS.searchIncludeHidden,
      }),
    ).toBe(true);
  });

  it('ignores ordering when comparing against the defaults', () => {
    expect(
      isDefaultSearchFilter({
        searchLayers: [...CHART_DEFAULTS.searchLayers].reverse(),
        searchAirspaceClasses: [...CHART_DEFAULTS.searchAirspaceClasses].reverse(),
        searchAirwayCategories: [...CHART_DEFAULTS.searchAirwayCategories].reverse(),
        searchIncludeHidden: false,
      }),
    ).toBe(true);
  });

  it('treats the all-classes default (including ARTCC) as default', () => {
    expect(
      isDefaultSearchFilter({
        searchLayers: [...CHART_DEFAULTS.searchLayers],
        searchAirspaceClasses: [...AIRSPACE_CLASSES],
        searchAirwayCategories: [...AIRWAY_CATEGORIES],
        searchIncludeHidden: false,
      }),
    ).toBe(true);
  });

  it('returns false when include-hidden is on', () => {
    expect(
      isDefaultSearchFilter({
        searchLayers: [...CHART_DEFAULTS.searchLayers],
        searchAirspaceClasses: [...CHART_DEFAULTS.searchAirspaceClasses],
        searchAirwayCategories: [...CHART_DEFAULTS.searchAirwayCategories],
        searchIncludeHidden: true,
      }),
    ).toBe(false);
  });

  it('returns false when the searchable layer set is narrowed', () => {
    expect(
      isDefaultSearchFilter({
        searchLayers: ['airports'],
        searchAirspaceClasses: [...CHART_DEFAULTS.searchAirspaceClasses],
        searchAirwayCategories: [...CHART_DEFAULTS.searchAirwayCategories],
        searchIncludeHidden: false,
      }),
    ).toBe(false);
  });

  it('returns false when the searchable airspace classes are narrowed', () => {
    expect(
      isDefaultSearchFilter({
        searchLayers: [...CHART_DEFAULTS.searchLayers],
        searchAirspaceClasses: ['CLASS_B'],
        searchAirwayCategories: [...CHART_DEFAULTS.searchAirwayCategories],
        searchIncludeHidden: false,
      }),
    ).toBe(false);
  });

  it('returns false when the searchable airway categories are narrowed', () => {
    expect(
      isDefaultSearchFilter({
        searchLayers: [...CHART_DEFAULTS.searchLayers],
        searchAirspaceClasses: [...CHART_DEFAULTS.searchAirspaceClasses],
        searchAirwayCategories: ['HIGH'],
        searchIncludeHidden: false,
      }),
    ).toBe(false);
  });
});
