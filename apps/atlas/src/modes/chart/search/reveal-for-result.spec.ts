import { describe, it, expect } from 'vitest';

import { revealLayersForResult } from './reveal-for-result.ts';
import type {
  AirportChartSearchResult,
  AirspaceChartSearchResult,
  AirwayChartSearchResult,
  FixChartSearchResult,
  NavaidChartSearchResult,
} from './search-features.ts';
import type { LayerSelection } from './search-scope.ts';

/** Fields shared by every result fixture; the helper only reads `kind`/`subtype`. */
const base = {
  selection: 'x',
  label: 'X',
  sublabel: undefined,
  matchedText: 'X',
  ranges: [],
  score: 1,
  center: { lng: 0, lat: 0 },
  hidden: true,
};

const airport: AirportChartSearchResult = { ...base, kind: 'airport', matchedField: 'faaId' };
const navaid: NavaidChartSearchResult = {
  ...base,
  kind: 'navaid',
  subtype: 'VOR',
  matchedField: 'identifier',
};
const fix: FixChartSearchResult = { ...base, kind: 'fix', matchedField: 'identifier' };
const victorAirway: AirwayChartSearchResult = {
  ...base,
  kind: 'airway',
  subtype: 'VICTOR',
  matchedField: 'designation',
  bbox: { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1 },
};
const oceanicAirway: AirwayChartSearchResult = {
  ...base,
  kind: 'airway',
  subtype: 'ATLANTIC',
  matchedField: 'designation',
  bbox: { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1 },
};
const classBAirspace: AirspaceChartSearchResult = {
  ...base,
  kind: 'airspace',
  subtype: 'CLASS_B',
  matchedField: 'identifier',
  bbox: { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1 },
};
const classE5Airspace: AirspaceChartSearchResult = {
  ...base,
  kind: 'airspace',
  subtype: 'CLASS_E5',
  matchedField: 'name',
  bbox: { minLon: 0, maxLon: 1, minLat: 0, maxLat: 1 },
};

/** Builds a Layers-menu selection with sensible empty defaults. */
function selection(overrides: Partial<LayerSelection> = {}): LayerSelection {
  return { layers: [], airspaceClasses: [], airwayCategories: [], ...overrides };
}

describe('revealLayersForResult', () => {
  it('enables the airports layer for an airport result', () => {
    const next = revealLayersForResult(airport, selection());
    expect(next.layers).toEqual(['airports']);
  });

  it('enables the navaids layer for a navaid result', () => {
    const next = revealLayersForResult(navaid, selection());
    expect(next.layers).toEqual(['navaids']);
  });

  it('enables the fixes layer for a fix result', () => {
    const next = revealLayersForResult(fix, selection());
    expect(next.layers).toEqual(['fixes']);
  });

  it('enables the airways layer and the matching category for an airway result', () => {
    const next = revealLayersForResult(victorAirway, selection());
    expect(next.layers).toEqual(['airways']);
    expect(next.airwayCategories).toEqual(['LOW']);
  });

  it('maps oceanic / colored airway types onto the OCEANIC category', () => {
    const next = revealLayersForResult(oceanicAirway, selection());
    expect(next.airwayCategories).toEqual(['OCEANIC']);
  });

  it('enables the airspace layer and the matching class for an airspace result', () => {
    const next = revealLayersForResult(classBAirspace, selection());
    expect(next.layers).toEqual(['airspace']);
    expect(next.airspaceClasses).toEqual(['CLASS_B']);
  });

  it('collapses the Class E stratum onto the single CLASS_E class', () => {
    const next = revealLayersForResult(classE5Airspace, selection());
    expect(next.airspaceClasses).toEqual(['CLASS_E']);
  });

  it('preserves canonical layer order when inserting a revealed layer', () => {
    const next = revealLayersForResult(airport, selection({ layers: ['airspace'] }));
    // airports sorts before airspace in LAYER_IDS.
    expect(next.layers).toEqual(['airports', 'airspace']);
  });

  it('preserves canonical class order when inserting a revealed airspace class', () => {
    const next = revealLayersForResult(
      classBAirspace,
      selection({ layers: ['airspace'], airspaceClasses: ['CLASS_C'] }),
    );
    // CLASS_B sorts before CLASS_C in AIRSPACE_CLASSES.
    expect(next.airspaceClasses).toEqual(['CLASS_B', 'CLASS_C']);
  });

  it('preserves canonical category order when inserting a revealed airway category', () => {
    const next = revealLayersForResult(
      victorAirway,
      selection({ layers: ['airways'], airwayCategories: ['HIGH'] }),
    );
    // LOW sorts before HIGH in AIRWAY_CATEGORIES.
    expect(next.airwayCategories).toEqual(['LOW', 'HIGH']);
  });

  it('leaves an already-visible layer untouched by identity', () => {
    const current = selection({ layers: ['navaids'] });
    const next = revealLayersForResult(navaid, current);
    expect(next.layers).toBe(current.layers);
  });

  it('leaves an already-visible airspace class untouched by identity', () => {
    const current = selection({ layers: ['airspace'], airspaceClasses: ['CLASS_B'] });
    const next = revealLayersForResult(classBAirspace, current);
    expect(next.layers).toBe(current.layers);
    expect(next.airspaceClasses).toBe(current.airspaceClasses);
  });

  it('leaves an already-visible airway category untouched by identity', () => {
    const current = selection({ layers: ['airways'], airwayCategories: ['LOW'] });
    const next = revealLayersForResult(victorAirway, current);
    expect(next.layers).toBe(current.layers);
    expect(next.airwayCategories).toBe(current.airwayCategories);
  });
});
