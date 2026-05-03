import { useCallback, useEffect, useRef, useState } from 'react';

import type { Airspace3DDialogChoice } from './airspace-3d-dialog.tsx';
import {
  AIRSPACE_3D_AUTO_HIDE_CLASSES,
  useAirspace3DAutoHidePreference,
} from './airspace-3d-preference.ts';
import type { Airspace3DAutoHidePreference } from './airspace-3d-preference.ts';
import { AIRSPACE_CLASSES, LAYER_IDS } from './url-state.ts';
import type { AirspaceClass, LayerId } from './url-state.ts';

/** Parameters for {@link useAirspace3DAutoHide}. */
export interface UseAirspace3DAutoHideParams {
  /** Current map pitch in degrees, sourced from the chart-mode URL state. */
  pitch: number;
  /** Currently visible airspace classes (mirrors the URL `airspaceClasses` field). */
  airspaceClasses: readonly AirspaceClass[];
  /** Currently visible top-level layers (mirrors the URL `layers` field). */
  layers: readonly LayerId[];
  /**
   * Writes the next airspace-class set and top-level layer set back into
   * URL state. The hook calls this with both fields together so the
   * navigate happens in one transition (no flicker), and so the parent
   * `airspace` layer can be auto-toggled when the class list becomes
   * empty (mirroring the existing `LayerToggle` behavior).
   */
  applyAirspaceState: (next: {
    airspaceClasses: readonly AirspaceClass[];
    layers: readonly LayerId[];
  }) => void;
}

/** Return value of {@link useAirspace3DAutoHide}. */
export interface UseAirspace3DAutoHideResult {
  /** Whether the auto-hide dialog should currently render. */
  dialogOpen: boolean;
  /** Resolver invoked by the dialog when the user picks an option. */
  onDialogResolve: (choice: Airspace3DDialogChoice) => void;
}

/**
 * Snapshot of the airspace classes and parent-layer state that were
 * removed by the most recent auto-hide. Used by the tilt-out handler
 * to restore granularly: only the classes that auto-hide removed are
 * re-added, so any other layer changes the user made during the 3D
 * session survive the round trip.
 */
interface AutoHideSnapshot {
  /** Subset of {@link AIRSPACE_3D_AUTO_HIDE_CLASSES} that auto-hide actually removed. */
  removedClasses: readonly AirspaceClass[];
  /** `true` when auto-hide also turned the parent `airspace` layer off (because the class set became empty). */
  airspaceParentDisabled: boolean;
}

const EMPTY_SNAPSHOT: AutoHideSnapshot = {
  removedClasses: [],
  airspaceParentDisabled: false,
};

/**
 * Computes the airspace-class set that auto-hide would produce, plus
 * the matching layers list (mirroring the parent-toggle coupling in
 * {@link LayerToggle}). Returns `undefined` when no class would be
 * removed, so callers can short-circuit without writing through to
 * navigate.
 */
function computeAutoHideNextState(
  airspaceClasses: readonly AirspaceClass[],
  layers: readonly LayerId[],
):
  | {
      nextAirspaceClasses: readonly AirspaceClass[];
      nextLayers: readonly LayerId[];
      removedClasses: readonly AirspaceClass[];
      airspaceParentDisabled: boolean;
    }
  | undefined {
  const removedClasses = AIRSPACE_3D_AUTO_HIDE_CLASSES.filter((cls) =>
    airspaceClasses.includes(cls),
  );
  if (removedClasses.length === 0) {
    return undefined;
  }
  const removedSet = new Set<AirspaceClass>(removedClasses);
  const nextAirspaceClasses = airspaceClasses.filter((cls) => !removedSet.has(cls));
  // Mirror LayerToggle: an empty airspace-class set drops the parent
  // `airspace` layer toggle so the dropdown checkbox state matches what
  // is actually rendered.
  const parentCurrentlyOn = layers.includes('airspace');
  const airspaceParentDisabled = parentCurrentlyOn && nextAirspaceClasses.length === 0;
  const nextLayers = airspaceParentDisabled
    ? layers.filter((layerId) => layerId !== 'airspace')
    : layers;
  return { nextAirspaceClasses, nextLayers, removedClasses, airspaceParentDisabled };
}

/**
 * Computes the airspace-class set and matching layers list produced by
 * a granular restore: re-adds only the snapshotted classes that aren't
 * already in the live state, and re-enables the parent `airspace` layer
 * when the snapshot recorded that auto-hide turned it off and the user
 * hasn't re-enabled it manually since.
 */
function computeRestoreNextState(
  airspaceClasses: readonly AirspaceClass[],
  layers: readonly LayerId[],
  snapshot: AutoHideSnapshot,
): {
  nextAirspaceClasses: readonly AirspaceClass[];
  nextLayers: readonly LayerId[];
} {
  const liveSet = new Set<AirspaceClass>(airspaceClasses);
  for (const cls of snapshot.removedClasses) {
    liveSet.add(cls);
  }
  // Preserve the canonical AIRSPACE_CLASSES order so URL serialization
  // stays stable regardless of insertion order.
  const nextAirspaceClasses = AIRSPACE_CLASSES.filter((cls) => liveSet.has(cls));
  const parentCurrentlyOn = layers.includes('airspace');
  const shouldReenableParent =
    snapshot.airspaceParentDisabled && !parentCurrentlyOn && nextAirspaceClasses.length > 0;
  const nextLayers = shouldReenableParent
    ? LAYER_IDS.filter((layerId) => layers.includes(layerId) || layerId === 'airspace')
    : layers;
  return { nextAirspaceClasses, nextLayers };
}

/**
 * Drives the "auto-hide blanket airspace classes when the camera tilts"
 * behavior for chart mode. Subscribes to pitch transitions and
 * orchestrates three things on each `0 -> >0` (tilt-in) transition:
 *
 * 1. Reads the persisted preference (`'ask'` / `'always'` / `'never'`).
 * 2. If the preference is `'always'` and at least one of
 *    {@link AIRSPACE_3D_AUTO_HIDE_CLASSES} is currently visible, removes
 *    those classes from URL state silently and snapshots the change.
 * 3. If the preference is `'ask'` under the same condition, opens the
 *    dialog. The dialog's resolution writes the snapshot (on accept)
 *    and optionally promotes the preference to `'always'` / `'never'`
 *    (when the user checks "Remember my choice").
 *
 * On the matching `>0 -> 0` (tilt-out) transition, the snapshot is
 * replayed in reverse: only the classes that auto-hide removed are
 * re-added. Other layer changes the user made during the 3D session
 * survive the round trip.
 *
 * Initial mount with `pitch > 0` (e.g. user landed on a shared URL) is
 * intentionally not treated as a transition - the previous-pitch ref
 * is seeded with the initial pitch, so no flow runs until the user
 * actually changes pitch.
 */
export function useAirspace3DAutoHide(
  params: UseAirspace3DAutoHideParams,
): UseAirspace3DAutoHideResult {
  const { pitch, airspaceClasses, layers, applyAirspaceState } = params;
  const [preference, setPreference] = useAirspace3DAutoHidePreference();
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const snapshotRef = useRef<AutoHideSnapshot>(EMPTY_SNAPSHOT);
  // Seeded from the initial pitch so the first useEffect run produces
  // no transition - landing on a shared URL with pitch > 0 does not
  // pop the dialog or run auto-hide.
  const previousPitchRef = useRef<number>(pitch);
  // Keeps the current airspaceClasses / layers reachable from inside
  // the pitch-transition effect without re-running the effect on every
  // toggle (which would otherwise treat each layer change as a fresh
  // tilt). The effect only depends on pitch; it reads the latest layer
  // state from this ref at the moment the transition fires. The ref
  // is updated in a separate effect rather than inline during render
  // to satisfy `react-hooks/refs` (which forbids ref writes during
  // render); the pitch-transition effect runs after this one in the
  // same commit phase, so the ref is always current when read there.
  const layerStateRef = useRef({ airspaceClasses, layers });
  useEffect((): void => {
    layerStateRef.current = { airspaceClasses, layers };
  }, [airspaceClasses, layers]);

  const applyAutoHide = useCallback((): void => {
    const { airspaceClasses: liveClasses, layers: liveLayers } = layerStateRef.current;
    const next = computeAutoHideNextState(liveClasses, liveLayers);
    if (next === undefined) {
      return;
    }
    snapshotRef.current = {
      removedClasses: next.removedClasses,
      airspaceParentDisabled: next.airspaceParentDisabled,
    };
    applyAirspaceState({
      airspaceClasses: next.nextAirspaceClasses,
      layers: next.nextLayers,
    });
  }, [applyAirspaceState]);

  const restoreFromSnapshot = useCallback((): void => {
    const snapshot = snapshotRef.current;
    if (snapshot.removedClasses.length === 0) {
      return;
    }
    const { airspaceClasses: liveClasses, layers: liveLayers } = layerStateRef.current;
    const next = computeRestoreNextState(liveClasses, liveLayers, snapshot);
    snapshotRef.current = EMPTY_SNAPSHOT;
    applyAirspaceState({
      airspaceClasses: next.nextAirspaceClasses,
      layers: next.nextLayers,
    });
  }, [applyAirspaceState]);

  const onDialogResolve = useCallback(
    (choice: Airspace3DDialogChoice): void => {
      setDialogOpen(false);
      if (choice.action === 'accept') {
        applyAutoHide();
        if (choice.remember) {
          setPreference('always');
        }
      } else if (choice.remember) {
        setPreference('never');
      }
    },
    [applyAutoHide, setPreference],
  );

  // Tracks whether the dialog is currently open without re-running the
  // pitch-transition effect when the dialog state changes. The
  // transition handler reads this ref to decide whether to ignore a
  // tilt-out (because the user is mid-decision in the dialog), but
  // the dialog open/close itself does not need to re-trigger the
  // effect.
  const dialogOpenRef = useRef<boolean>(false);
  useEffect((): void => {
    dialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);

  // Seeded from the initial preference so the first effect run produces
  // no preference transition - landing on a shared session with
  // `'always'` already persisted does not re-fire the auto-hide logic
  // until the user actually flips a switch.
  const previousPreferenceRef = useRef<Airspace3DAutoHidePreference>(preference);

  useEffect((): void => {
    const previousPitch = previousPitchRef.current;
    const previousPreference = previousPreferenceRef.current;
    previousPitchRef.current = pitch;
    previousPreferenceRef.current = preference;

    const pitchChanged = previousPitch !== pitch;
    const preferenceChanged = previousPreference !== preference;
    if (!pitchChanged && !preferenceChanged) {
      return;
    }

    // Strictly modal: while the dialog is open, the user must resolve
    // it via "Hide them" or "Keep them visible" before any pitch
    // change is processed. This prevents tilting back to plan view
    // (or any other gesture that mutates pitch) from dismissing the
    // dialog without an explicit choice. The refs above are still
    // updated so the next transition is computed against live state,
    // not a stale snapshot.
    if (dialogOpenRef.current) {
      return;
    }

    // Half-degree threshold for "in 3D" vs "plan view". MapLibre's
    // `easeTo` can land at sub-degree float drift (e.g. 1e-7 instead
    // of 0), and an exact `=== 0` comparison would silently miss the
    // tilt-out transition - the snapshot would never restore, and the
    // next tilt-in's `previousPitch === 0` check would also fail.
    // 0.5 is well below any tilt step the UI exposes (15 degrees) so
    // a real "almost flat" pitch is still treated as plan view.
    const previousIs3D = previousPitch > 0.5;
    const currentIs3D = pitch > 0.5;

    if (pitchChanged && !previousIs3D && currentIs3D) {
      // Tilt-in. Skip if no blanket class is currently visible
      // (auto-hide would be a no-op and the dialog would have nothing
      // meaningful to ask about).
      const hasTriggerClass = AIRSPACE_3D_AUTO_HIDE_CLASSES.some((cls) =>
        layerStateRef.current.airspaceClasses.includes(cls),
      );
      if (!hasTriggerClass) {
        return;
      }
      if (preference === 'always') {
        applyAutoHide();
      } else if (preference === 'ask') {
        // The dialog is purely a transition-driven UX response - it
        // opens once per plan -> 3D pitch change and closes when the
        // user picks an option. The lint rule's "compute it during
        // render" advice doesn't fit a one-shot event-style trigger
        // like this; resolution happens via the dialog's resolver,
        // not by re-deriving from props.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDialogOpen(true);
      }
      return;
    }

    if (pitchChanged && previousIs3D && !currentIs3D) {
      // Tilt-out. Replay the snapshot if auto-hide had run earlier.
      // The dialog is intentionally not closed here - if it were
      // somehow open at this point, the modal-guard above would have
      // already short-circuited the effect.
      restoreFromSnapshot();
      return;
    }

    // Preference flipped (independent of any pitch transition above).
    // The dropdown checkbox toggles between `'always'` and `'never'`;
    // treat the toggle as an immediate command rather than waiting for
    // the next tilt cycle, since the user's mental model is "this
    // setting controls what's visible right now in 3D, not just what
    // will happen on the next tilt-in."
    if (preferenceChanged) {
      if (previousPreference !== 'always' && preference === 'always' && currentIs3D) {
        // Toggle ON while in 3D - apply auto-hide if at least one
        // blanket class is currently visible. If none are,
        // applyAutoHide is a no-op and the snapshot stays empty.
        const hasTriggerClass = AIRSPACE_3D_AUTO_HIDE_CLASSES.some((cls) =>
          layerStateRef.current.airspaceClasses.includes(cls),
        );
        if (hasTriggerClass) {
          applyAutoHide();
        }
      } else if (previousPreference === 'always' && preference !== 'always') {
        // Toggle OFF - revert any auto-hide that ran during this 3D
        // session so the checkbox reads as a symmetric "show / hide"
        // control. Run regardless of current pitch: if the user
        // toggled off in plan view (e.g. they tilted down before
        // unchecking), the snapshot still needs to clear so the next
        // tilt-in starts from a clean state. `restoreFromSnapshot`
        // is a no-op when the snapshot is already empty.
        restoreFromSnapshot();
      }
    }
  }, [pitch, preference, applyAutoHide, restoreFromSnapshot]);

  return { dialogOpen, onDialogResolve };
}
