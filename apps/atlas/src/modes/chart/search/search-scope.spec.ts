import { describe, it, expect } from 'vitest';

import type { AirspaceType, AirwayType } from '@squawk/types';

import { RENDERED_AIRPORT_FACILITY_TYPES, RENDERED_NAVAID_TYPES } from '../layers/drawable-sets.ts';

import { computeLayerVisibility, computeSearchScope } from './search-scope.ts';
import type { LayerSelection } from './search-scope.ts';

/**
 * Builds a {@link LayerSelection} from partial overrides, defaulting to an
 * empty selection so each test states only the layers and sub-classes it
 * cares about.
 */
function selection(overrides: Partial<LayerSelection> = {}): LayerSelection {
  return {
    layers: overrides.layers ?? [],
    airspaceClasses: overrides.airspaceClasses ?? [],
    airwayCategories: overrides.airwayCategories ?? [],
  };
}

describe('computeLayerVisibility', () => {
  it('reflects the enabled point layers', () => {
    const visibility = computeLayerVisibility(selection({ layers: ['airports', 'fixes'] }));
    expect(visibility.airports).toBe(true);
    expect(visibility.fixes).toBe(true);
    expect(visibility.navaids).toBe(false);
  });

  it('expands enabled airway categories into their underlying types', () => {
    const visibility = computeLayerVisibility(
      selection({ layers: ['airways'], airwayCategories: ['LOW'] }),
    );
    expect([...visibility.airwayTypes].sort()).toEqual(['RNAV_T', 'VICTOR']);
  });

  it('expands enabled airspace classes into their underlying types', () => {
    const visibility = computeLayerVisibility(
      selection({ layers: ['airspace'], airspaceClasses: ['CLASS_E'] }),
    );
    expect([...visibility.airspaceTypes].sort()).toEqual([
      'CLASS_E2',
      'CLASS_E3',
      'CLASS_E4',
      'CLASS_E5',
      'CLASS_E6',
      'CLASS_E7',
    ]);
  });

  it('yields no airway types when the airways layer is disabled, even with categories set', () => {
    const visibility = computeLayerVisibility(selection({ airwayCategories: ['LOW', 'HIGH'] }));
    expect(visibility.airwayTypes.size).toBe(0);
  });

  it('yields no airspace types when the airspace layer is disabled, even with classes set', () => {
    const visibility = computeLayerVisibility(selection({ airspaceClasses: ['CLASS_B'] }));
    expect(visibility.airspaceTypes.size).toBe(0);
  });
});

describe('computeSearchScope', () => {
  it('disables a dataset the filter omits, even when it is visible', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['airports', 'navaids'] }),
      filter: selection({ layers: ['navaids'] }),
      includeHidden: false,
    });
    expect(scope.airports.enabled).toBe(false);
    expect(scope.navaids.enabled).toBe(true);
  });

  it('gates a filtered dataset by visibility when hidden results are excluded', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['navaids'] }),
      filter: selection({ layers: ['airports'] }),
      includeHidden: false,
    });
    expect(scope.airports.enabled).toBe(false);
  });

  it('enables a hidden filtered dataset when include-hidden is on', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['navaids'] }),
      filter: selection({ layers: ['airports'] }),
      includeHidden: true,
    });
    expect(scope.airports.enabled).toBe(true);
  });

  it('always scopes airport and navaid queries to the rendered drawable sets', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['airports', 'navaids'] }),
      filter: selection({ layers: ['airports', 'navaids'] }),
      includeHidden: false,
    });
    expect(scope.airports.types).toBe(RENDERED_AIRPORT_FACILITY_TYPES);
    expect(scope.navaids.types).toBe(RENDERED_NAVAID_TYPES);
  });

  it('intersects airway filter categories with the visible types when hidden is excluded', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['airways'], airwayCategories: ['LOW'] }),
      filter: selection({ layers: ['airways'], airwayCategories: ['LOW', 'HIGH'] }),
      includeHidden: false,
    });
    expect(scope.airways.enabled).toBe(true);
    expect([...scope.airways.types].sort()).toEqual<AirwayType[]>(['RNAV_T', 'VICTOR']);
  });

  it('passes the full airway filter scope through when include-hidden is on', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['airways'], airwayCategories: ['LOW'] }),
      filter: selection({ layers: ['airways'], airwayCategories: ['LOW', 'HIGH'] }),
      includeHidden: true,
    });
    expect([...scope.airways.types].sort()).toEqual<AirwayType[]>([
      'JET',
      'RNAV_Q',
      'RNAV_T',
      'VICTOR',
    ]);
  });

  it('disables airways when no in-scope type survives the visibility gate', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['airways'], airwayCategories: ['LOW'] }),
      filter: selection({ layers: ['airways'], airwayCategories: ['HIGH'] }),
      includeHidden: false,
    });
    expect(scope.airways.enabled).toBe(false);
    expect(scope.airways.types.size).toBe(0);
  });

  it('disables airways when the filter omits the airways layer', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['airways'], airwayCategories: ['LOW'] }),
      filter: selection({ airwayCategories: ['LOW'] }),
      includeHidden: true,
    });
    expect(scope.airways.enabled).toBe(false);
    expect(scope.airways.types.size).toBe(0);
  });

  it('intersects airspace filter classes with the visible types when hidden is excluded', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['airspace'], airspaceClasses: ['CLASS_B'] }),
      filter: selection({ layers: ['airspace'], airspaceClasses: ['CLASS_B', 'CLASS_C'] }),
      includeHidden: false,
    });
    expect(scope.airspace.enabled).toBe(true);
    expect([...scope.airspace.types].sort()).toEqual<AirspaceType[]>(['CLASS_B']);
  });

  it('disables airspace when no in-scope type survives the visibility gate', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['airspace'], airspaceClasses: ['CLASS_B'] }),
      filter: selection({ layers: ['airspace'], airspaceClasses: ['CLASS_C'] }),
      includeHidden: false,
    });
    expect(scope.airspace.enabled).toBe(false);
    expect(scope.airspace.types.size).toBe(0);
  });

  it('treats fixes as a flag-only scope with no subtype filter', () => {
    const scope = computeSearchScope({
      layers: selection({ layers: ['fixes'] }),
      filter: selection({ layers: ['fixes'] }),
      includeHidden: false,
    });
    expect(scope.fixes).toEqual({ enabled: true });
  });
});
