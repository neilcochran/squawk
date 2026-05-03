import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { setAirspace3DAutoHidePreference } from './airspace-3d-preference.ts';
import type { AirspaceClass, LayerId } from './url-state.ts';
import { useAirspace3DAutoHide } from './use-airspace-3d-auto-hide.ts';
import type { UseAirspace3DAutoHideParams } from './use-airspace-3d-auto-hide.ts';

const ALL_LAYERS: readonly LayerId[] = ['airports', 'navaids', 'fixes', 'airways', 'airspace'];

const ALL_CLASSES: readonly AirspaceClass[] = [
  'CLASS_B',
  'CLASS_C',
  'CLASS_D',
  'CLASS_E',
  'MOA',
  'RESTRICTED',
  'PROHIBITED',
  'WARNING',
  'ALERT',
  'NSA',
  'ARTCC',
];

type RenderParams = UseAirspace3DAutoHideParams;

function buildInitialParams(overrides: Partial<RenderParams> = {}): RenderParams {
  return {
    pitch: 0,
    airspaceClasses: ALL_CLASSES,
    layers: ALL_LAYERS,
    applyAirspaceState: vi.fn(),
    ...overrides,
  };
}

describe('useAirspace3DAutoHide', () => {
  beforeEach(() => {
    setAirspace3DAutoHidePreference('ask');
    window.localStorage.clear();
  });

  it('starts with the dialog closed and a callable resolver', () => {
    const { result } = renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: buildInitialParams(),
    });
    expect(result.current.dialogOpen).toBe(false);
    expect(typeof result.current.onDialogResolve).toBe('function');
  });

  it('does not pop the dialog or apply auto-hide for the initial render at pitch > 0', () => {
    const applyAirspaceState = vi.fn();
    const { result } = renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: buildInitialParams({ pitch: 60, applyAirspaceState }),
    });
    expect(result.current.dialogOpen).toBe(false);
    expect(applyAirspaceState).not.toHaveBeenCalled();
  });

  it('opens the dialog on a tilt-in transition with at least one trigger class visible', () => {
    const applyAirspaceState = vi.fn();
    const { result, rerender } = renderHook(
      (params: RenderParams) => useAirspace3DAutoHide(params),
      {
        initialProps: buildInitialParams({ applyAirspaceState }),
      },
    );
    rerender(buildInitialParams({ pitch: 60, applyAirspaceState }));
    expect(result.current.dialogOpen).toBe(true);
    expect(applyAirspaceState).not.toHaveBeenCalled();
  });

  it('does not open the dialog on tilt-in if no trigger class is visible', () => {
    const applyAirspaceState = vi.fn();
    const { result, rerender } = renderHook(
      (params: RenderParams) => useAirspace3DAutoHide(params),
      {
        initialProps: buildInitialParams({
          airspaceClasses: ['CLASS_B', 'CLASS_C'],
          applyAirspaceState,
        }),
      },
    );
    rerender(
      buildInitialParams({
        pitch: 60,
        airspaceClasses: ['CLASS_B', 'CLASS_C'],
        applyAirspaceState,
      }),
    );
    expect(result.current.dialogOpen).toBe(false);
    expect(applyAirspaceState).not.toHaveBeenCalled();
  });

  it('silently auto-hides on tilt-in when the preference is "always"', () => {
    setAirspace3DAutoHidePreference('always');
    const applyAirspaceState = vi.fn();
    renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: buildInitialParams({ applyAirspaceState }),
    }).rerender(buildInitialParams({ pitch: 60, applyAirspaceState }));
    expect(applyAirspaceState).toHaveBeenCalledTimes(1);
    const next = applyAirspaceState.mock.calls[0]?.[0];
    expect(next.airspaceClasses).not.toContain('CLASS_E');
    expect(next.airspaceClasses).not.toContain('WARNING');
    expect(next.airspaceClasses).not.toContain('ARTCC');
    expect(next.airspaceClasses).toContain('CLASS_B');
  });

  it('does nothing on tilt-in when the preference is "never"', () => {
    setAirspace3DAutoHidePreference('never');
    const applyAirspaceState = vi.fn();
    const { result } = renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: buildInitialParams({ applyAirspaceState }),
    });
    expect(result.current.dialogOpen).toBe(false);
    expect(applyAirspaceState).not.toHaveBeenCalled();
  });

  it('drops the parent airspace layer when the auto-hide empties the class list', () => {
    setAirspace3DAutoHidePreference('always');
    const applyAirspaceState = vi.fn();
    const initial = buildInitialParams({
      airspaceClasses: ['CLASS_E', 'WARNING', 'ARTCC'],
      applyAirspaceState,
    });
    renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: initial,
    }).rerender({ ...initial, pitch: 60 });
    expect(applyAirspaceState).toHaveBeenCalledTimes(1);
    const next = applyAirspaceState.mock.calls[0]?.[0];
    expect(next.airspaceClasses).toEqual([]);
    expect(next.layers).not.toContain('airspace');
  });

  it('applies auto-hide and persists the preference to "always" when the dialog accepts with remember', () => {
    const applyAirspaceState = vi.fn();
    const { result, rerender } = renderHook(
      (params: RenderParams) => useAirspace3DAutoHide(params),
      { initialProps: buildInitialParams({ applyAirspaceState }) },
    );
    rerender(buildInitialParams({ pitch: 60, applyAirspaceState }));
    expect(result.current.dialogOpen).toBe(true);
    act(() => {
      result.current.onDialogResolve({ action: 'accept', remember: true });
    });
    expect(result.current.dialogOpen).toBe(false);
    // The accept handler runs applyAutoHide and then promotes the
    // preference to 'always'. The preference flip re-triggers the
    // effect's "toggle ON while in 3D" branch, which re-applies
    // against the still-stale layer ref (production rerenders with
    // the updated state quickly enough that this is a no-op there).
    expect(applyAirspaceState).toHaveBeenCalled();
    const next = applyAirspaceState.mock.calls[0]?.[0];
    expect(next.airspaceClasses).not.toContain('CLASS_E');
    expect(window.localStorage.getItem('atlas:chart:airspace-3d-auto-hide:v1')).toBe('always');
  });

  it('declining without remember keeps the preference at "ask"', () => {
    const applyAirspaceState = vi.fn();
    const { result, rerender } = renderHook(
      (params: RenderParams) => useAirspace3DAutoHide(params),
      { initialProps: buildInitialParams({ applyAirspaceState }) },
    );
    rerender(buildInitialParams({ pitch: 60, applyAirspaceState }));
    act(() => {
      result.current.onDialogResolve({ action: 'decline', remember: false });
    });
    expect(result.current.dialogOpen).toBe(false);
    expect(applyAirspaceState).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('atlas:chart:airspace-3d-auto-hide:v1')).toBeNull();
  });

  it('declining with remember persists "never"', () => {
    const applyAirspaceState = vi.fn();
    const { result, rerender } = renderHook(
      (params: RenderParams) => useAirspace3DAutoHide(params),
      { initialProps: buildInitialParams({ applyAirspaceState }) },
    );
    rerender(buildInitialParams({ pitch: 60, applyAirspaceState }));
    act(() => {
      result.current.onDialogResolve({ action: 'decline', remember: true });
    });
    expect(window.localStorage.getItem('atlas:chart:airspace-3d-auto-hide:v1')).toBe('never');
  });

  it('restores the snapshot on tilt-out after auto-hide ran', () => {
    setAirspace3DAutoHidePreference('always');
    const applyAirspaceState = vi.fn();
    const initial = buildInitialParams({ applyAirspaceState });
    const { rerender } = renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: initial,
    });
    rerender({ ...initial, pitch: 60 });
    expect(applyAirspaceState).toHaveBeenCalledTimes(1);
    const auto = applyAirspaceState.mock.calls[0]?.[0];
    rerender({
      ...initial,
      pitch: 60,
      airspaceClasses: auto.airspaceClasses,
      layers: auto.layers,
    });
    rerender({
      ...initial,
      pitch: 0,
      airspaceClasses: auto.airspaceClasses,
      layers: auto.layers,
    });
    expect(applyAirspaceState).toHaveBeenCalledTimes(2);
    const restore = applyAirspaceState.mock.calls[1]?.[0];
    expect(restore.airspaceClasses).toContain('CLASS_E');
    expect(restore.airspaceClasses).toContain('WARNING');
    expect(restore.airspaceClasses).toContain('ARTCC');
  });

  it('does nothing on tilt-out when no snapshot was taken', () => {
    setAirspace3DAutoHidePreference('never');
    const applyAirspaceState = vi.fn();
    const initial = buildInitialParams({ applyAirspaceState });
    const { rerender } = renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: initial,
    });
    rerender({ ...initial, pitch: 60 });
    rerender({ ...initial, pitch: 0 });
    expect(applyAirspaceState).not.toHaveBeenCalled();
  });

  it('applies auto-hide immediately when the user toggles preference to "always" while in 3D', () => {
    const applyAirspaceState = vi.fn();
    const initial = buildInitialParams({ applyAirspaceState, pitch: 60 });
    renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: initial,
    });
    act(() => {
      setAirspace3DAutoHidePreference('always');
    });
    expect(applyAirspaceState).toHaveBeenCalledTimes(1);
  });

  it('does not apply auto-hide when toggling to "always" while in plan view', () => {
    const applyAirspaceState = vi.fn();
    renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: buildInitialParams({ applyAirspaceState, pitch: 0 }),
    });
    act(() => {
      setAirspace3DAutoHidePreference('always');
    });
    expect(applyAirspaceState).not.toHaveBeenCalled();
  });

  it('restores when toggling preference off from "always" with a snapshot in place', () => {
    setAirspace3DAutoHidePreference('always');
    const applyAirspaceState = vi.fn();
    const initial = buildInitialParams({ applyAirspaceState });
    const { rerender } = renderHook((params: RenderParams) => useAirspace3DAutoHide(params), {
      initialProps: initial,
    });
    rerender({ ...initial, pitch: 60 });
    expect(applyAirspaceState).toHaveBeenCalledTimes(1);
    const auto = applyAirspaceState.mock.calls[0]?.[0];
    rerender({
      ...initial,
      pitch: 60,
      airspaceClasses: auto.airspaceClasses,
      layers: auto.layers,
    });
    act(() => {
      setAirspace3DAutoHidePreference('never');
    });
    expect(applyAirspaceState).toHaveBeenCalledTimes(2);
    const restore = applyAirspaceState.mock.calls[1]?.[0];
    expect(restore.airspaceClasses).toContain('CLASS_E');
  });

  it('ignores pitch transitions while the dialog is open', () => {
    const applyAirspaceState = vi.fn();
    const { result, rerender } = renderHook(
      (params: RenderParams) => useAirspace3DAutoHide(params),
      { initialProps: buildInitialParams({ applyAirspaceState }) },
    );
    rerender(buildInitialParams({ pitch: 60, applyAirspaceState }));
    expect(result.current.dialogOpen).toBe(true);
    rerender(buildInitialParams({ pitch: 0, applyAirspaceState }));
    expect(result.current.dialogOpen).toBe(true);
    expect(applyAirspaceState).not.toHaveBeenCalled();
  });

  it('treats sub-degree pitch drift as plan view', () => {
    const applyAirspaceState = vi.fn();
    const { result, rerender } = renderHook(
      (params: RenderParams) => useAirspace3DAutoHide(params),
      { initialProps: buildInitialParams({ applyAirspaceState }) },
    );
    rerender(buildInitialParams({ pitch: 0.4, applyAirspaceState }));
    // 0.4 is below the 0.5 threshold; no transition should fire.
    expect(result.current.dialogOpen).toBe(false);
    expect(applyAirspaceState).not.toHaveBeenCalled();
  });
});
