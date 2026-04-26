import { describe, it, expect } from 'vitest';
import { CHART_DEFAULTS, chartSearchSchema } from './url-state.ts';

describe('chartSearchSchema', () => {
  it('returns the chart defaults when no search params are provided', () => {
    expect(chartSearchSchema.parse({})).toEqual(CHART_DEFAULTS);
  });

  it('preserves valid in-range values', () => {
    const input = { lat: 40, lon: -100, zoom: 6 };
    expect(chartSearchSchema.parse(input)).toEqual(input);
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

  it('falls back to defaults when the input has the wrong type', () => {
    // The `.catch(default)` clauses on each field cover this: a stale
    // share-link with garbage values still produces a usable view
    // rather than throwing at the route boundary.
    const result = chartSearchSchema.parse({ lat: 'not-a-number', zoom: null });
    expect(result.lat).toBe(CHART_DEFAULTS.lat);
    expect(result.zoom).toBe(CHART_DEFAULTS.zoom);
  });
});
