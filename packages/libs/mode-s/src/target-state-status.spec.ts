import { describe, it, expect } from 'vitest';

import { decodeTargetStateAndStatus } from './target-state-status.js';
import { setBits } from './test-utils.js';

describe('decodeTargetStateAndStatus', () => {
  it('decodes a fully-populated message with mode status active', () => {
    const me = new Uint8Array(7);
    setBits(me, 0, 5, 29); // type code
    setBits(me, 8, 1, 1); // altitude source: FMS
    setBits(me, 9, 11, 101); // (101-1)*32 = 3200 ft
    setBits(me, 20, 9, 267); // 800+(267-1)*0.8 = 1012.8 mb
    setBits(me, 29, 1, 1); // heading status valid
    setBits(me, 30, 9, 256); // 256*360/512 = 180 deg
    setBits(me, 39, 4, 9); // NAC_p
    setBits(me, 43, 1, 1); // NIC_baro
    setBits(me, 44, 2, 2); // SIL
    setBits(me, 46, 1, 1); // mode status valid
    setBits(me, 47, 1, 1); // autopilot
    setBits(me, 48, 1, 0); // vnav
    setBits(me, 49, 1, 1); // altitude hold
    setBits(me, 51, 1, 0); // approach
    setBits(me, 52, 1, 1); // tcas operational
    setBits(me, 53, 1, 1); // lnav

    expect(decodeTargetStateAndStatus(me)).toEqual({
      selectedAltitudeSource: 'fms',
      selectedAltitudeFt: 3200,
      baroPressureSettingMb: 1012.8,
      selectedHeadingDeg: 180,
      navAccuracyCategoryPosition: 9,
      nicBaro: true,
      sourceIntegrityLevel: 2,
      autopilotEngaged: true,
      vnavModeActive: false,
      altitudeHoldModeActive: true,
      approachModeActive: false,
      lnavModeActive: true,
      tcasOperational: true,
    });
  });

  it('reports MCP/FCU as the altitude source when the source bit is unset', () => {
    const me = new Uint8Array(7);
    setBits(me, 8, 1, 0); // altitude source: MCP/FCU
    setBits(me, 9, 11, 2); // nonzero, so source is populated

    const result = decodeTargetStateAndStatus(me);
    expect(result.selectedAltitudeSource).toBe('mcpFcu');
  });

  it('reports undefined altitude and source when the altitude field is zero (N/A)', () => {
    const me = new Uint8Array(7);
    setBits(me, 8, 1, 1); // source bit set, but altitude value stays 0
    const result = decodeTargetStateAndStatus(me);
    expect(result.selectedAltitudeFt).toBeUndefined();
    expect(result.selectedAltitudeSource).toBeUndefined();
  });

  it('reports undefined baro pressure setting when the field is zero (N/A)', () => {
    const me = new Uint8Array(7);
    expect(decodeTargetStateAndStatus(me).baroPressureSettingMb).toBeUndefined();
  });

  it('reports undefined heading when the heading status bit is unset', () => {
    const me = new Uint8Array(7);
    setBits(me, 30, 9, 256); // nonzero raw heading, but status bit unset
    expect(decodeTargetStateAndStatus(me).selectedHeadingDeg).toBeUndefined();
  });

  it('reports undefined for all five mode flags when mode status is unset, but still reports tcasOperational', () => {
    const me = new Uint8Array(7);
    setBits(me, 46, 1, 0); // mode status invalid
    setBits(me, 47, 1, 1); // autopilot bit set anyway - must be ignored
    setBits(me, 52, 1, 1); // tcas operational, not gated by mode status

    const result = decodeTargetStateAndStatus(me);
    expect(result.autopilotEngaged).toBeUndefined();
    expect(result.vnavModeActive).toBeUndefined();
    expect(result.altitudeHoldModeActive).toBeUndefined();
    expect(result.approachModeActive).toBeUndefined();
    expect(result.lnavModeActive).toBeUndefined();
    expect(result.tcasOperational).toBe(true);
  });
});
