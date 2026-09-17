import { useEffect, useRef } from 'react';

import type { Aircraft } from '@squawk/types';

import { isEmergencyAircraft } from './format.js';
import { matchesWatchlist } from './watchlist.js';

/** Inputs for {@link useAlerts}. */
export interface AlertOptions {
  /** The currently tracked aircraft, registration-enriched and unfiltered - alerts are about what is tracked, not what the table happens to show. */
  aircraft: readonly Aircraft[];
  /** Normalized `--watch` terms; empty for no watchlist. */
  watchlist: readonly string[];
  /** Whether an aircraft entering an emergency state (`--alert-emergency`) rings too. */
  alertEmergency: boolean;
  /** Whether the bell may ring right now. False under `--no-bell` and while paused; changes that happen while disabled are dropped, not queued. */
  enabled: boolean;
  /** Rings the bell. Injected so tests can observe it; production passes {@link ringTerminalBell}. */
  ring: () => void;
}

/**
 * Rings the terminal bell by writing BEL straight to stdout. Bypasses Ink's
 * own `write` deliberately: that path clears and redraws the app to insert
 * a line above it, while BEL is zero-width and moves nothing, so a raw
 * write cannot disturb Ink's rendered output.
 */
export function ringTerminalBell(): void {
  process.stdout.write('\u0007');
}

/**
 * Rings the bell when a watched aircraft appears or disappears from the
 * tracked list, and (with `alertEmergency`) when an aircraft first becomes
 * an emergency. Works by diffing the set of matching ICAO hexes between
 * renders rather than listening to feed events, so a watch by N-number
 * still fires when the registration resolves a few seconds after the
 * aircraft first appears. At most one ring per update batch, since several
 * bells in one tick are indistinguishable anyway.
 *
 * @param options - The tracked aircraft, watch terms, and bell controls.
 */
export function useAlerts(options: AlertOptions): void {
  const { aircraft, watchlist, alertEmergency, enabled, ring } = options;
  const watchedHexes = useRef<ReadonlySet<string>>(new Set());
  const emergencyHexes = useRef<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const watchedNow = new Set(
      aircraft
        .filter((candidate) => matchesWatchlist(candidate, watchlist))
        .map((candidate) => candidate.icaoHex),
    );
    const emergencyNow = new Set(
      aircraft.filter(isEmergencyAircraft).map((candidate) => candidate.icaoHex),
    );
    const watchedBefore = watchedHexes.current;
    const emergencyBefore = emergencyHexes.current;
    watchedHexes.current = watchedNow;
    emergencyHexes.current = emergencyNow;

    const watchedChanged =
      [...watchedNow].some((hex) => !watchedBefore.has(hex)) ||
      [...watchedBefore].some((hex) => !watchedNow.has(hex));
    const emergencyStarted =
      alertEmergency && [...emergencyNow].some((hex) => !emergencyBefore.has(hex));

    if (enabled && (watchedChanged || emergencyStarted)) {
      ring();
    }
  }, [aircraft, watchlist, alertEmergency, enabled, ring]);
}
