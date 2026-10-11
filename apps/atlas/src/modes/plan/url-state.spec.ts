import { describe, it, expect } from 'vitest';

import { PLAN_DEFAULTS, planSearchSchema } from './url-state.ts';

describe('planSearchSchema', () => {
  it('returns the plan defaults when no search params are provided', () => {
    const result = planSearchSchema.parse({});
    expect(result.lat).toBe(PLAN_DEFAULTS.lat);
    expect(result.lon).toBe(PLAN_DEFAULTS.lon);
    expect(result.zoom).toBe(PLAN_DEFAULTS.zoom);
    expect(result.pitch).toBe(PLAN_DEFAULTS.pitch);
    expect(result.route).toBe(PLAN_DEFAULTS.route);
    expect(result.gs).toBeUndefined();
  });

  it('preserves valid in-range view values', () => {
    const result = planSearchSchema.parse({ lat: 40, lon: -100, zoom: 6, pitch: 30 });
    expect(result).toMatchObject({ lat: 40, lon: -100, zoom: 6, pitch: 30 });
  });

  it('falls back to defaults for out-of-range view values', () => {
    expect(planSearchSchema.parse({ lat: 200 }).lat).toBe(PLAN_DEFAULTS.lat);
    expect(planSearchSchema.parse({ lon: -500 }).lon).toBe(PLAN_DEFAULTS.lon);
    expect(planSearchSchema.parse({ zoom: 100 }).zoom).toBe(PLAN_DEFAULTS.zoom);
    expect(planSearchSchema.parse({ pitch: 200 }).pitch).toBe(PLAN_DEFAULTS.pitch);
  });

  it('falls back to defaults for wrong-typed view values', () => {
    const result = planSearchSchema.parse({ lat: 'x', zoom: null, pitch: 'tilt' });
    expect(result.lat).toBe(PLAN_DEFAULTS.lat);
    expect(result.zoom).toBe(PLAN_DEFAULTS.zoom);
    expect(result.pitch).toBe(PLAN_DEFAULTS.pitch);
  });

  it('defaults the route to an empty string when absent', () => {
    expect(planSearchSchema.parse({}).route).toBe('');
  });

  it('preserves a route string', () => {
    const result = planSearchSchema.parse({ route: 'KJFK DCT MERIT J60 MARTN DCT KLAX' });
    expect(result.route).toBe('KJFK DCT MERIT J60 MARTN DCT KLAX');
  });

  it('falls back to an empty route when the value is not a string', () => {
    expect(planSearchSchema.parse({ route: 123 }).route).toBe('');
  });

  it('returns gs as undefined when absent', () => {
    expect(planSearchSchema.parse({}).gs).toBeUndefined();
  });

  it('preserves a valid ground speed', () => {
    expect(planSearchSchema.parse({ gs: 450 }).gs).toBe(450);
  });

  it('falls back to undefined for an out-of-range ground speed', () => {
    expect(planSearchSchema.parse({ gs: 0 }).gs).toBeUndefined();
    expect(planSearchSchema.parse({ gs: 5000 }).gs).toBeUndefined();
  });

  it('falls back to undefined for a non-numeric ground speed', () => {
    expect(planSearchSchema.parse({ gs: 'fast' }).gs).toBeUndefined();
  });
});
