import { describe, it, expect } from 'vitest';
import {
  AIRSPACE_CLASSES,
  AIRWAY_CATEGORIES,
  CHART_DEFAULTS,
  LAYER_IDS,
  LAYER_MIN_ZOOM,
  chartSearchSchema,
} from './url-state.ts';

describe('chartSearchSchema', () => {
  it('returns the chart defaults when no search params are provided', () => {
    expect(chartSearchSchema.parse({})).toEqual(CHART_DEFAULTS);
  });

  it('preserves valid in-range values and applies the array defaults', () => {
    const input = { lat: 40, lon: -100, zoom: 6 };
    expect(chartSearchSchema.parse(input)).toEqual({
      ...input,
      pitch: CHART_DEFAULTS.pitch,
      layers: [...LAYER_IDS],
      airspaceClasses: [...CHART_DEFAULTS.airspaceClasses],
      airwayCategories: [...AIRWAY_CATEGORIES],
    });
  });

  it('falls back to the default lat when the input is out of range', () => {
    const result = chartSearchSchema.parse({ lat: 200 });
    expect(result.lat).toBe(CHART_DEFAULTS.lat);
  });

  it('falls back to the default lon when the input is out of range', () => {
    const result = chartSearchSchema.parse({ lon: -500 });
    expect(result.lon).toBe(CHART_DEFAULTS.lon);
  });

  it('falls back to the default zoom when the input is out of range', () => {
    const result = chartSearchSchema.parse({ zoom: 100 });
    expect(result.zoom).toBe(CHART_DEFAULTS.zoom);
  });

  it('returns the default pitch (0) when absent', () => {
    const result = chartSearchSchema.parse({});
    expect(result.pitch).toBe(CHART_DEFAULTS.pitch);
  });

  it('preserves a valid in-range pitch', () => {
    const result = chartSearchSchema.parse({ pitch: 30 });
    expect(result.pitch).toBe(30);
  });

  it('falls back to the default pitch when the input is below 0', () => {
    const result = chartSearchSchema.parse({ pitch: -10 });
    expect(result.pitch).toBe(CHART_DEFAULTS.pitch);
  });

  it('falls back to the default pitch when the input is above the map cap', () => {
    const result = chartSearchSchema.parse({ pitch: 200 });
    expect(result.pitch).toBe(CHART_DEFAULTS.pitch);
  });

  it('falls back to the default pitch when the input is the wrong type', () => {
    const result = chartSearchSchema.parse({ pitch: 'not-a-number' });
    expect(result.pitch).toBe(CHART_DEFAULTS.pitch);
  });

  it('falls back to defaults when the input has the wrong type', () => {
    // The `.catch(default)` clauses on each field cover this: a stale
    // share-link with garbage values still produces a usable view
    // rather than throwing at the route boundary.
    const result = chartSearchSchema.parse({ lat: 'not-a-number', zoom: null });
    expect(result.lat).toBe(CHART_DEFAULTS.lat);
    expect(result.zoom).toBe(CHART_DEFAULTS.zoom);
  });

  it('preserves a valid subset of layer ids', () => {
    const result = chartSearchSchema.parse({ layers: ['airports', 'airways'] });
    expect(result.layers).toEqual(['airports', 'airways']);
  });

  it('preserves an empty layers array as the basemap-only state', () => {
    const result = chartSearchSchema.parse({ layers: [] });
    expect(result.layers).toEqual([]);
  });

  it('falls back to all layers when an unknown id appears', () => {
    const result = chartSearchSchema.parse({ layers: ['airports', 'not-a-real-layer'] });
    expect(result.layers).toEqual([...LAYER_IDS]);
  });

  it('falls back to all layers when layers is not an array', () => {
    const result = chartSearchSchema.parse({ layers: 'airports' });
    expect(result.layers).toEqual([...LAYER_IDS]);
  });

  it('preserves a valid subset of airspace classes', () => {
    const result = chartSearchSchema.parse({ airspaceClasses: ['CLASS_B', 'MOA'] });
    expect(result.airspaceClasses).toEqual(['CLASS_B', 'MOA']);
  });

  it('preserves an empty airspaceClasses array as the layer-renders-nothing state', () => {
    const result = chartSearchSchema.parse({ airspaceClasses: [] });
    expect(result.airspaceClasses).toEqual([]);
  });

  it('falls back to the default airspace classes when an unknown class appears', () => {
    const result = chartSearchSchema.parse({ airspaceClasses: ['CLASS_B', 'CLASS_E2'] });
    // CLASS_E2 is an underlying AirspaceType but not a user-facing class id;
    // the schema treats it as unknown and falls back to the default. The
    // default is every user-facing class except ARTCC.
    expect(result.airspaceClasses).toEqual([...CHART_DEFAULTS.airspaceClasses]);
  });

  it('falls back to the default airspace classes when airspaceClasses is not an array', () => {
    const result = chartSearchSchema.parse({ airspaceClasses: 'CLASS_B' });
    expect(result.airspaceClasses).toEqual([...CHART_DEFAULTS.airspaceClasses]);
  });

  it('preserves a valid subset of airway categories', () => {
    const result = chartSearchSchema.parse({ airwayCategories: ['LOW', 'OCEANIC'] });
    expect(result.airwayCategories).toEqual(['LOW', 'OCEANIC']);
  });

  it('preserves an empty airwayCategories array as the layer-renders-nothing state', () => {
    const result = chartSearchSchema.parse({ airwayCategories: [] });
    expect(result.airwayCategories).toEqual([]);
  });

  it('falls back to all airway categories when an unknown category appears', () => {
    const result = chartSearchSchema.parse({ airwayCategories: ['LOW', 'VICTOR'] });
    // VICTOR is an underlying AirwayType but not a user-facing category id;
    // the schema treats it as unknown and falls back to the default.
    expect(result.airwayCategories).toEqual([...AIRWAY_CATEGORIES]);
  });

  it('falls back to all airway categories when airwayCategories is not an array', () => {
    const result = chartSearchSchema.parse({ airwayCategories: 'LOW' });
    expect(result.airwayCategories).toEqual([...AIRWAY_CATEGORIES]);
  });

  it('returns selected as undefined when absent', () => {
    const result = chartSearchSchema.parse({});
    expect(result.selected).toBeUndefined();
  });

  it('preserves a string selected value', () => {
    const result = chartSearchSchema.parse({ selected: 'airport:BOS' });
    expect(result.selected).toBe('airport:BOS');
  });

  it('falls back to undefined when selected is not a string', () => {
    // The `.catch(undefined)` clause keeps stale or programmatic-error URLs
    // (e.g. an array slipped into ?selected=) from throwing at the route
    // boundary. Validation of the parsed string lives in entity.ts, not here.
    const result = chartSearchSchema.parse({ selected: ['airport:BOS'] });
    expect(result.selected).toBeUndefined();
  });
});

describe('CHART_DEFAULTS', () => {
  it('excludes ARTCC from the default airspace classes', () => {
    // ARTCC sectors blanket the entire chart at the CONUS default zoom and
    // visually drown out every other airspace tint, so they're opted out of
    // the first-load view. The toggle still exposes ARTCC as an option, just
    // not as a default.
    expect(CHART_DEFAULTS.airspaceClasses).not.toContain('ARTCC');
    expect(AIRSPACE_CLASSES).toContain('ARTCC');
  });

  it('includes every other airspace class in the defaults', () => {
    // Every class besides ARTCC is in the default-on set. Re-asserting this
    // here (rather than just trusting the filter expression) catches a
    // future drift if someone reorders or renames a class without updating
    // the default.
    for (const cls of AIRSPACE_CLASSES) {
      if (cls === 'ARTCC') {
        continue;
      }
      expect(CHART_DEFAULTS.airspaceClasses).toContain(cls);
    }
  });
});

describe('LAYER_MIN_ZOOM', () => {
  it('gates fixes at zoom 7 and below', () => {
    expect(LAYER_MIN_ZOOM.fixes).toBe(7);
  });

  it('gates navaids at zoom 5 and below', () => {
    expect(LAYER_MIN_ZOOM.navaids).toBe(5);
  });

  it('does not gate airports, airspace, or airways at the layer level', () => {
    // Missing keys are the encoding for "no zoom gating"; the layer toggle
    // and the MapLibre Layer both treat undefined as "render at every zoom".
    // Airways are deliberately absent because the layer renders the
    // high-altitude J / Q backbone at every zoom and gates the V/T web
    // via an internal per-feature filter rather than a layer-level minzoom.
    expect(LAYER_MIN_ZOOM.airports).toBeUndefined();
    expect(LAYER_MIN_ZOOM.airspace).toBeUndefined();
    expect(LAYER_MIN_ZOOM.airways).toBeUndefined();
  });
});
