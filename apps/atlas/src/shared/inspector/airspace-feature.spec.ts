import { describe, it, expect } from 'vitest';
import { compareAirspaceByAltitudeDesc } from './airspace-feature.ts';
import type { AirspaceAltitudeKey } from './airspace-feature.ts';

describe('compareAirspaceByAltitudeDesc', () => {
  it('sorts higher ceilings before lower ceilings', () => {
    const high: AirspaceAltitudeKey = { ceilingFt: 18000, floorFt: 0 };
    const low: AirspaceAltitudeKey = { ceilingFt: 10000, floorFt: 0 };
    const ordered = [low, high].sort(compareAirspaceByAltitudeDesc);
    expect(ordered).toEqual([high, low]);
  });

  it('breaks ties by higher floor first', () => {
    // Two Class B rings sharing the same ceiling: the outer ring (higher
    // floor) should come before the inner ring (SFC floor). This matches
    // the "top-down altitude stack" mental model the inspector renders.
    const outerRing: AirspaceAltitudeKey = { ceilingFt: 10000, floorFt: 3000 };
    const innerRing: AirspaceAltitudeKey = { ceilingFt: 10000, floorFt: 0 };
    const ordered = [innerRing, outerRing].sort(compareAirspaceByAltitudeDesc);
    expect(ordered).toEqual([outerRing, innerRing]);
  });

  it('returns 0 for two identical altitude keys', () => {
    // Stable sort: identical keys preserve input order.
    const same: AirspaceAltitudeKey = { ceilingFt: 5000, floorFt: 1000 };
    expect(compareAirspaceByAltitudeDesc(same, same)).toBe(0);
  });

  it('orders an ARTCC stack as HIGH then LOW', () => {
    // ARTCC sectors come in stratums; HIGH sits above LOW. Sorting a
    // dataset-order pair should always land HIGH first regardless of
    // the input order.
    const low: AirspaceAltitudeKey = { ceilingFt: 18000, floorFt: 0 };
    const high: AirspaceAltitudeKey = { ceilingFt: 60000, floorFt: 18000 };
    expect([low, high].sort(compareAirspaceByAltitudeDesc)).toEqual([high, low]);
    expect([high, low].sort(compareAirspaceByAltitudeDesc)).toEqual([high, low]);
  });
});
