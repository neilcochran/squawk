import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { collectEventDetails } from './test-utils.js';
import { createTracker } from './tracker.js';
import type {
  AircraftLostEventDetail,
  AircraftUpdateEventDetail,
  ConnectionStateEventDetail,
} from './types/index.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ingest', () => {
  it('dispatches aircraft:new the first time an icaoHex is seen', () => {
    const tracker = createTracker({});
    const events = collectEventDetails<AircraftUpdateEventDetail>(tracker, 'aircraft:new');

    tracker.ingest({ icaoHex: 'A0B1C2', callsign: 'UAL123' });

    expect(events).toHaveLength(1);
    expect(events[0]?.aircraft.icaoHex).toBe('A0B1C2');
    expect(events[0]?.aircraft.callsign).toBe('UAL123');
  });

  it('dispatches aircraft:update, not aircraft:new, for a subsequent ingest of the same icaoHex', () => {
    const tracker = createTracker({});
    const newEvents = collectEventDetails<AircraftUpdateEventDetail>(tracker, 'aircraft:new');
    const updateEvents = collectEventDetails<AircraftUpdateEventDetail>(tracker, 'aircraft:update');

    tracker.ingest({ icaoHex: 'A0B1C2', callsign: 'UAL123' });
    tracker.ingest({ icaoHex: 'A0B1C2', groundSpeedKt: 250 });

    expect(newEvents).toHaveLength(1);
    expect(updateEvents).toHaveLength(1);
    expect(updateEvents[0]?.aircraft.groundSpeedKt).toBe(250);
  });

  it('merges partial updates onto existing tracked fields rather than replacing them', () => {
    const tracker = createTracker({});

    tracker.ingest({ icaoHex: 'A0B1C2', callsign: 'UAL123' });
    tracker.ingest({ icaoHex: 'A0B1C2', groundSpeedKt: 250 });

    const aircraft = tracker.getAircraft('A0B1C2');
    expect(aircraft?.callsign).toBe('UAL123');
    expect(aircraft?.groundSpeedKt).toBe(250);
  });

  it('stamps lastSeenAt with the receipt time on every ingest', () => {
    const tracker = createTracker({});
    vi.setSystemTime(1_000_000);

    tracker.ingest({ icaoHex: 'A0B1C2' });

    expect(tracker.getAircraft('A0B1C2')?.lastSeenAt).toBe(1_000_000);
  });
});

describe('getAircraft / getAllAircraft', () => {
  it('returns undefined for an untracked icaoHex', () => {
    const tracker = createTracker({});
    expect(tracker.getAircraft('FFFFFF')).toBeUndefined();
  });

  it('returns every currently tracked aircraft', () => {
    const tracker = createTracker({});
    tracker.ingest({ icaoHex: 'A0B1C2' });
    tracker.ingest({ icaoHex: 'B1C2D3' });

    const all = tracker.getAllAircraft();
    expect(all.map((a) => a.icaoHex).sort()).toEqual(['A0B1C2', 'B1C2D3']);
  });
});

describe('position history', () => {
  it('records a history entry only when the update carries a fresh lat/lon', () => {
    const tracker = createTracker({});
    tracker.ingest({ icaoHex: 'A0B1C2', callsign: 'UAL123' });
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 40, lon: -74 });

    expect(tracker.getPositionHistory('A0B1C2')).toHaveLength(1);
  });

  it('trims history to positionHistoryRetention.maxEntries, keeping the most recent', () => {
    const tracker = createTracker({ positionHistoryRetention: { maxEntries: 2 } });

    tracker.ingest({ icaoHex: 'A0B1C2', lat: 1, lon: 1 });
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 2, lon: 2 });
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 3, lon: 3 });

    const history = tracker.getPositionHistory('A0B1C2');
    expect(history).toHaveLength(2);
    expect(history.map((h) => h.position.lat)).toEqual([2, 3]);
  });

  it('drops history entries older than positionHistoryRetention.maxAgeMs', () => {
    const tracker = createTracker({ positionHistoryRetention: { maxAgeMs: 10_000 } });

    vi.setSystemTime(0);
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 1, lon: 1 });

    vi.setSystemTime(20_000);
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 2, lon: 2 });

    const history = tracker.getPositionHistory('A0B1C2');
    expect(history).toHaveLength(1);
    expect(history[0]?.position.lat).toBe(2);
  });

  it('returns an empty array for an untracked or position-less aircraft', () => {
    const tracker = createTracker({});
    tracker.ingest({ icaoHex: 'A0B1C2' });

    expect(tracker.getPositionHistory('A0B1C2')).toEqual([]);
    expect(tracker.getPositionHistory('FFFFFF')).toEqual([]);
  });
});

describe('position/altitude merging', () => {
  it('preserves a previously known position when a later update reports altitude only', () => {
    const tracker = createTracker({});
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 40, lon: -74 });
    tracker.ingest({ icaoHex: 'A0B1C2', baroAltitudeFt: 5500 });

    const aircraft = tracker.getAircraft('A0B1C2');
    expect(aircraft?.position).toEqual({ lat: 40, lon: -74, baroAltitudeFt: 5500 });
  });

  it('does not record position history for an altitude-only update', () => {
    const tracker = createTracker({});
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 40, lon: -74 });
    tracker.ingest({ icaoHex: 'A0B1C2', baroAltitudeFt: 5500 });

    expect(tracker.getPositionHistory('A0B1C2')).toHaveLength(1);
  });

  it('drops altitude reported before any position is known - Position requires coordinates', () => {
    const tracker = createTracker({});
    tracker.ingest({ icaoHex: 'A0B1C2', baroAltitudeFt: 5500 });

    expect(tracker.getAircraft('A0B1C2')?.position).toBeUndefined();
  });

  it('preserves a previously known altitude when a later update reports position only', () => {
    const tracker = createTracker({});
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 40, lon: -74, baroAltitudeFt: 5500 });
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 41, lon: -75 });

    expect(tracker.getAircraft('A0B1C2')?.position).toEqual({
      lat: 41,
      lon: -75,
      baroAltitudeFt: 5500,
    });
  });
});

describe('staleness sweep', () => {
  it('dispatches aircraft:lost and stops tracking an aircraft once staleAfterMs elapses without an update', () => {
    const tracker = createTracker({ staleAfterMs: 30_000 });
    const lostEvents = collectEventDetails<AircraftLostEventDetail>(tracker, 'aircraft:lost');

    tracker.ingest({ icaoHex: 'A0B1C2', callsign: 'UAL123' });
    vi.advanceTimersByTime(35_000);

    expect(lostEvents).toHaveLength(1);
    expect(lostEvents[0]?.icaoHex).toBe('A0B1C2');
    expect(lostEvents[0]?.lastAircraft.callsign).toBe('UAL123');
    expect(tracker.getAircraft('A0B1C2')).toBeUndefined();
  });

  it('does not dispatch aircraft:lost while updates keep arriving within the staleness window', () => {
    const tracker = createTracker({ staleAfterMs: 30_000 });
    const lostEvents = collectEventDetails<AircraftLostEventDetail>(tracker, 'aircraft:lost');

    tracker.ingest({ icaoHex: 'A0B1C2' });
    vi.advanceTimersByTime(20_000);
    tracker.ingest({ icaoHex: 'A0B1C2' });
    vi.advanceTimersByTime(20_000);

    expect(lostEvents).toHaveLength(0);
    expect(tracker.getAircraft('A0B1C2')).toBeDefined();
  });

  it('also clears position history for a lost aircraft', () => {
    const tracker = createTracker({ staleAfterMs: 10_000 });
    tracker.ingest({ icaoHex: 'A0B1C2', lat: 1, lon: 1 });

    vi.advanceTimersByTime(15_000);

    expect(tracker.getPositionHistory('A0B1C2')).toEqual([]);
  });
});

describe('dispose', () => {
  it('stops the sweep timer so no further aircraft:lost events fire', () => {
    const tracker = createTracker({ staleAfterMs: 10_000 });
    const lostEvents = collectEventDetails<AircraftLostEventDetail>(tracker, 'aircraft:lost');

    tracker.ingest({ icaoHex: 'A0B1C2' });
    tracker.dispose();
    vi.advanceTimersByTime(60_000);

    expect(lostEvents).toHaveLength(0);
  });

  it('clears all tracked aircraft', () => {
    const tracker = createTracker({});
    tracker.ingest({ icaoHex: 'A0B1C2' });

    tracker.dispose();

    expect(tracker.getAllAircraft()).toEqual([]);
  });

  it('resets connection state back to reconnecting', () => {
    const tracker = createTracker({});
    tracker.setConnectionState('connected');

    tracker.dispose();

    expect(tracker.getConnectionState()).toBe('reconnecting');
  });
});

describe('connection state', () => {
  it('defaults to reconnecting before any transition', () => {
    const tracker = createTracker({});
    expect(tracker.getConnectionState()).toBe('reconnecting');
  });

  it('dispatches connection:connect and updates the queryable state', () => {
    const tracker = createTracker({});
    const events = collectEventDetails<ConnectionStateEventDetail>(tracker, 'connection:connect');

    tracker.setConnectionState('connected');

    expect(tracker.getConnectionState()).toBe('connected');
    expect(events).toHaveLength(1);
    expect(events[0]?.state).toBe('connected');
  });

  it('dispatches connection:disconnect when transitioning away from connected', () => {
    const tracker = createTracker({});
    tracker.setConnectionState('connected');
    const events = collectEventDetails<ConnectionStateEventDetail>(
      tracker,
      'connection:disconnect',
    );

    tracker.setConnectionState('reconnecting');

    expect(tracker.getConnectionState()).toBe('reconnecting');
    expect(events).toHaveLength(1);
    expect(events[0]?.state).toBe('reconnecting');
  });

  it('does not dispatch an event when the state is set to its current value', () => {
    const tracker = createTracker({});
    const connectEvents = collectEventDetails<ConnectionStateEventDetail>(
      tracker,
      'connection:connect',
    );
    const disconnectEvents = collectEventDetails<ConnectionStateEventDetail>(
      tracker,
      'connection:disconnect',
    );

    tracker.setConnectionState('reconnecting');
    tracker.setConnectionState('connected');
    tracker.setConnectionState('connected');

    expect(connectEvents).toHaveLength(1);
    expect(disconnectEvents).toHaveLength(0);
  });
});
