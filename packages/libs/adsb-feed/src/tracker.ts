import type { Aircraft, Position } from '@squawk/types';

import type {
  AircraftFeedOptions,
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
  PositionHistoryEntry,
} from './types/index.js';

/** Default staleness window before an aircraft is considered lost. */
const DEFAULT_STALE_AFTER_MS = 60_000;
/** Default interval between staleness sweeps. */
const DEFAULT_SWEEP_INTERVAL_MS = 5_000;

/**
 * Normalized fields for one aircraft update, as produced by a source's
 * mapping function. `icaoHex` is required; every other field is optional and
 * merged onto the aircraft's existing tracked state. Fields a source cannot
 * currently determine must be omitted entirely, not set to `undefined`.
 *
 * `lat` / `lon` / `baroAltitudeFt` / `geoAltitudeFt` are flattened here
 * rather than nested under a single `position` field (unlike `Aircraft`
 * itself) because a source can legitimately report a fresh altitude without
 * a fresh position in the same update (e.g. an SBS Mode S surveillance-only
 * reply carries altitude but no coordinates). `Tracker.ingest` merges these
 * onto any previously known position rather than replacing it wholesale, so
 * an altitude-only update can't clobber a good position with missing
 * coordinates, and a position-only update keeps the last known altitude.
 */
export type AircraftUpdate = { icaoHex: string } & Partial<
  Omit<Aircraft, 'icaoHex' | 'lastSeenAt' | 'position'>
> & {
    /** Latitude for this update, if the source reported a fresh position. Always paired with `lon`. */
    lat?: number;
    /** Longitude for this update, if the source reported a fresh position. Always paired with `lat`. */
    lon?: number;
    /** Barometric altitude for this update, if reported - independent of whether a fresh position accompanied it. */
    baroAltitudeFt?: number;
    /** Geometric altitude for this update, if reported - independent of whether a fresh position accompanied it. */
    geoAltitudeFt?: number;
  };

/**
 * Internal stateful engine shared by every `create*AircraftFeed` factory.
 * Not part of the package's public API - sources call `ingest` for each
 * normalized update they produce, and expose the returned `EventTarget`
 * (augmented with these query methods) as the public `AircraftFeed`.
 */
export interface Tracker extends EventTarget {
  /** Merges a partial update into the tracked aircraft, stamping receipt time and dispatching `aircraft:new` or `aircraft:update`. */
  ingest(update: AircraftUpdate): void;
  /** Returns the current normalized state for one aircraft, or undefined if not currently tracked. */
  getAircraft(icaoHex: string): Aircraft | undefined;
  /** Returns the current normalized state for every currently tracked aircraft. */
  getAllAircraft(): Aircraft[];
  /** Returns the retained position history for one aircraft, oldest first. */
  getPositionHistory(icaoHex: string): PositionHistoryEntry[];
  /** Stops the staleness sweep timer and clears all tracked state. */
  dispose(): void;
}

/**
 * Merges the position-shaped fields of an update onto a previously known
 * position. Returns undefined if neither the update nor the existing state
 * has ever established a lat/lon - `Position` requires coordinates, so an
 * altitude reported before any position is known has nowhere to live.
 */
function mergePosition(
  existing: Position | undefined,
  update: AircraftUpdate,
): Position | undefined {
  const lat = update.lat ?? existing?.lat;
  const lon = update.lon ?? existing?.lon;
  if (lat === undefined || lon === undefined) {
    return undefined;
  }
  const baroAltitudeFt = update.baroAltitudeFt ?? existing?.baroAltitudeFt;
  const geoAltitudeFt = update.geoAltitudeFt ?? existing?.geoAltitudeFt;
  return {
    lat,
    lon,
    ...(baroAltitudeFt !== undefined ? { baroAltitudeFt } : {}),
    ...(geoAltitudeFt !== undefined ? { geoAltitudeFt } : {}),
  };
}

/**
 * Creates the internal tracking engine shared by every source. Merges
 * partial per-aircraft updates into current state, dispatching
 * `aircraft:new` / `aircraft:update` (both carrying
 * {@link AircraftUpdateEventDetail}) on each `ingest`, and dispatching
 * `aircraft:lost` (carrying {@link AircraftLostEventDetail}) for any
 * aircraft that goes longer than `staleAfterMs` without an update.
 *
 * Neither aircraft.json nor SBS carries an explicit "removed" signal, so
 * both sources rely on this same timeout-based sweep for loss detection.
 *
 * @param options - Staleness and position-history retention configuration.
 * @returns A `Tracker` ready to receive `ingest` calls.
 */
export function createTracker(options: AircraftFeedOptions): Tracker {
  const target = new EventTarget();
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const retention = options.positionHistoryRetention;

  const aircraftByHex = new Map<string, Aircraft>();
  const historyByHex = new Map<string, PositionHistoryEntry[]>();

  const sweepHandle = setInterval(sweep, DEFAULT_SWEEP_INTERVAL_MS);

  function sweep(): void {
    const now = Date.now();
    for (const [icaoHex, aircraft] of aircraftByHex) {
      if (now - aircraft.lastSeenAt > staleAfterMs) {
        aircraftByHex.delete(icaoHex);
        historyByHex.delete(icaoHex);
        const detail: AircraftLostEventDetail = { icaoHex, lastAircraft: aircraft };
        target.dispatchEvent(new CustomEvent<AircraftLostEventDetail>('aircraft:lost', { detail }));
      }
    }
  }

  function recordPosition(icaoHex: string, position: Position): void {
    const now = Date.now();
    const entries = [...(historyByHex.get(icaoHex) ?? []), { position, recordedAt: now }];
    const maxAgeMs = retention?.maxAgeMs;
    const withinAge =
      maxAgeMs === undefined
        ? entries
        : entries.filter((entry) => now - entry.recordedAt <= maxAgeMs);
    const maxEntries = retention?.maxEntries;
    const trimmed = maxEntries === undefined ? withinAge : withinAge.slice(-maxEntries);
    historyByHex.set(icaoHex, trimmed);
  }

  return Object.assign(target, {
    ingest(update: AircraftUpdate): void {
      const existing = aircraftByHex.get(update.icaoHex);
      const {
        lat,
        lon,
        baroAltitudeFt: _baroAltitudeFt,
        geoAltitudeFt: _geoAltitudeFt,
        ...rest
      } = update;
      const position = mergePosition(existing?.position, update);
      const merged: Aircraft = {
        ...existing,
        ...rest,
        icaoHex: update.icaoHex,
        lastSeenAt: Date.now(),
        ...(position ? { position } : {}),
      };
      aircraftByHex.set(update.icaoHex, merged);
      // Only append to history when this update itself carried a fresh
      // lat/lon - an altitude-only update merges onto the existing position
      // (see mergePosition) but shouldn't duplicate a history entry for a
      // location that hasn't actually changed.
      if (position && lat !== undefined && lon !== undefined) {
        recordPosition(update.icaoHex, position);
      }
      const detail: AircraftUpdateEventDetail = { aircraft: merged };
      const eventType = existing === undefined ? 'aircraft:new' : 'aircraft:update';
      target.dispatchEvent(new CustomEvent<AircraftUpdateEventDetail>(eventType, { detail }));
    },
    getAircraft(icaoHex: string): Aircraft | undefined {
      return aircraftByHex.get(icaoHex);
    },
    getAllAircraft(): Aircraft[] {
      return Array.from(aircraftByHex.values());
    },
    getPositionHistory(icaoHex: string): PositionHistoryEntry[] {
      return [...(historyByHex.get(icaoHex) ?? [])];
    },
    dispose(): void {
      clearInterval(sweepHandle);
      aircraftByHex.clear();
      historyByHex.clear();
    },
  });
}
