import { useSyncExternalStore } from 'react';
import type { AirspaceClass } from './url-state.ts';

/**
 * Airspace classes auto-hidden when the user enters 3D view (pitch > 0)
 * and {@link Airspace3DAutoHidePreference} resolves to "apply". The set
 * is intentionally narrow: Class E forms a near-CONUS-wide controlled
 * airspace blanket, Warning blocks line the coasts, and ARTCC sectors
 * cover the entire country in a single layer - all three would
 * dominate the 3D scene and obscure smaller terminal / special-use
 * airspaces. Pilots can re-enable any of them mid-3D via the layer
 * toggle; the snapshot in `chart-mode.tsx` only restores the subset
 * that was active when the auto-hide ran.
 */
export const AIRSPACE_3D_AUTO_HIDE_CLASSES: readonly AirspaceClass[] = [
  'CLASS_E',
  'WARNING',
  'ARTCC',
];

/**
 * User-controlled preference for the "auto-hide blanket airspace
 * classes when the camera tilts" behavior. Persisted in localStorage
 * (per-browser, no URL pollution) and read on every tilt-in
 * transition.
 *
 * - `'ask'` is the default for first-time users. The chart-mode tilt
 *   handler opens the auto-hide dialog on every `0 -> >0` transition
 *   while at least one of {@link AIRSPACE_3D_AUTO_HIDE_CLASSES} is
 *   currently visible. Selecting "Remember this choice" in the dialog
 *   transitions the preference into `'always'` or `'never'` and ends
 *   the prompt.
 * - `'always'` auto-hides the blanket classes silently on every
 *   tilt-in, with no dialog.
 * - `'never'` leaves layer state alone on tilt-in, with no dialog.
 *
 * The dropdown checkbox in {@link LayerToggle} only flips between
 * `'always'` (checked) and `'never'` (unchecked); `'ask'` is reachable
 * only as the initial default state for users who have not yet
 * interacted with the dialog.
 */
export type Airspace3DAutoHidePreference = 'ask' | 'always' | 'never';

/** Default preference value for users who have never interacted with the auto-hide flow. */
export const AIRSPACE_3D_AUTO_HIDE_DEFAULT: Airspace3DAutoHidePreference = 'ask';

/** localStorage key for the persisted preference. Versioned so a future schema change can deprecate cleanly. */
const STORAGE_KEY = 'atlas:chart:airspace-3d-auto-hide:v1';

/**
 * Type guard narrowing an arbitrary value to a valid
 * {@link Airspace3DAutoHidePreference}. Used by the storage reader to
 * fall back to the default when the persisted value is missing,
 * corrupted, or from an older schema that did not include this field.
 */
function isAirspace3DAutoHidePreference(value: unknown): value is Airspace3DAutoHidePreference {
  return value === 'ask' || value === 'always' || value === 'never';
}

/**
 * Reads the persisted preference from localStorage. Returns
 * {@link AIRSPACE_3D_AUTO_HIDE_DEFAULT} when localStorage is
 * unavailable (private browsing on some engines), the key is
 * unset, or the stored value fails the type guard.
 */
function readAirspace3DAutoHidePreference(): Airspace3DAutoHidePreference {
  if (typeof window === 'undefined') {
    return AIRSPACE_3D_AUTO_HIDE_DEFAULT;
  }
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return AIRSPACE_3D_AUTO_HIDE_DEFAULT;
  }
  if (raw === null) {
    return AIRSPACE_3D_AUTO_HIDE_DEFAULT;
  }
  return isAirspace3DAutoHidePreference(raw) ? raw : AIRSPACE_3D_AUTO_HIDE_DEFAULT;
}

/**
 * Writes the preference to localStorage. Swallows quota / disabled-storage
 * errors so a failed write degrades gracefully to in-memory-only state
 * (the React hook still updates and the in-session behavior is correct;
 * it just won't persist across reloads).
 */
function writeAirspace3DAutoHidePreference(value: Airspace3DAutoHidePreference): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage disabled or full - in-session state still tracks via the
    // hook's useState; persistence is best-effort.
  }
}

/**
 * Module-level shared store for the auto-hide preference. Several
 * chart-mode components consume the preference - the layer-toggle's
 * dropdown checkbox, the auto-hide hook in chart-mode, and the dialog
 * resolver - and they all need to observe the same value. The
 * previous implementation used `useState` per consumer, which gave
 * each component its own React state copy: when one called
 * `setPreference` the others' copies stayed stale until next reload.
 * This module-level store + {@link useSyncExternalStore} subscription
 * fixes that by routing every read and write through a single cached
 * value with explicit subscriber notification.
 */
let cachedPreference: Airspace3DAutoHidePreference = readAirspace3DAutoHidePreference();
const preferenceSubscribers = new Set<() => void>();

/**
 * Subscribes to preference changes. Returns an unsubscribe function.
 * Used as the `subscribe` argument to {@link useSyncExternalStore}.
 */
function subscribeToPreference(callback: () => void): () => void {
  preferenceSubscribers.add(callback);
  return (): void => {
    preferenceSubscribers.delete(callback);
  };
}

/**
 * Returns the cached preference value. Used as the `getSnapshot`
 * argument to {@link useSyncExternalStore}. Identity-stable across
 * calls within the same value, which is what the hook requires to
 * avoid render loops.
 */
function getPreferenceSnapshot(): Airspace3DAutoHidePreference {
  return cachedPreference;
}

/**
 * Updates the auto-hide preference for every consumer in the React
 * tree at once: writes the new value to localStorage, refreshes the
 * module-level cache, and notifies every subscribed component so
 * `useSyncExternalStore` re-renders them with the latest snapshot.
 * No-ops when the value is unchanged so unrelated state updates don't
 * trigger spurious re-renders.
 *
 * Exported for tests; production call sites should use
 * {@link useAirspace3DAutoHidePreference} which returns this setter
 * as the second tuple element.
 */
export function setAirspace3DAutoHidePreference(value: Airspace3DAutoHidePreference): void {
  if (cachedPreference === value) {
    return;
  }
  cachedPreference = value;
  writeAirspace3DAutoHidePreference(value);
  for (const subscriber of preferenceSubscribers) {
    subscriber();
  }
}

/**
 * React hook returning the current persisted auto-hide preference and a
 * setter that writes through to localStorage and notifies every other
 * consumer in the same React tree. Backed by
 * {@link useSyncExternalStore} so multiple components reading the
 * preference see the same value - the layer-toggle's checkbox state
 * and the auto-hide hook's transition logic stay in lockstep.
 *
 * The setter does not poll for cross-tab changes - if the user opens
 * chart mode in two tabs and changes the preference in one, the
 * other will keep its in-memory copy until next reload. That trade is
 * acceptable for this preference (low write rate, no synchronization
 * stakes).
 *
 * @returns A tuple of `[preference, setPreference]`. Calling
 *   `setPreference(next)` updates the cache, writes localStorage, and
 *   re-renders every other consumer in one call.
 */
export function useAirspace3DAutoHidePreference(): readonly [
  Airspace3DAutoHidePreference,
  (next: Airspace3DAutoHidePreference) => void,
] {
  const preference = useSyncExternalStore(subscribeToPreference, getPreferenceSnapshot);
  return [preference, setAirspace3DAutoHidePreference] as const;
}
