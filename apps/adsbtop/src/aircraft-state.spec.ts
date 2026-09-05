import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { aircraftStateReducer, initialAircraftState } from './aircraft-state.js';

function makeAircraft(icaoHex: string, overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex, lastSeenAt: 0, ...overrides };
}

describe('aircraftStateReducer', () => {
  it('adds a new aircraft on a message action', () => {
    const state = aircraftStateReducer(initialAircraftState, {
      type: 'message',
      kind: 'new',
      aircraft: makeAircraft('A0B1C2'),
      at: 1000,
    });

    expect(state.aircraftByHex.get('A0B1C2')?.icaoHex).toBe('A0B1C2');
    expect(state.messageCount).toBe(1);
    expect(state.lastMessageAt).toBe(1000);
  });

  it('replaces an existing aircraft entry and increments the message count', () => {
    const first = aircraftStateReducer(initialAircraftState, {
      type: 'message',
      kind: 'new',
      aircraft: makeAircraft('A0B1C2', { callsign: 'UAL123' }),
      at: 1000,
    });
    const second = aircraftStateReducer(first, {
      type: 'message',
      kind: 'update',
      aircraft: makeAircraft('A0B1C2', { callsign: 'UAL123', groundSpeedKt: 250 }),
      at: 2000,
    });

    expect(second.aircraftByHex.get('A0B1C2')?.groundSpeedKt).toBe(250);
    expect(second.messageCount).toBe(2);
    expect(second.lastMessageAt).toBe(2000);
  });

  it('removes an aircraft on a lost action', () => {
    const tracked = aircraftStateReducer(initialAircraftState, {
      type: 'message',
      kind: 'new',
      aircraft: makeAircraft('A0B1C2'),
      at: 1000,
    });
    const lost = aircraftStateReducer(tracked, {
      type: 'lost',
      icaoHex: 'A0B1C2',
      callsign: undefined,
      at: 1500,
    });

    expect(lost.aircraftByHex.has('A0B1C2')).toBe(false);
    expect(lost.messageCount).toBe(1);
  });

  it('logs a lost action for an unknown icaoHex without touching aircraftByHex', () => {
    const lost = aircraftStateReducer(initialAircraftState, {
      type: 'lost',
      icaoHex: 'FFFFFF',
      callsign: undefined,
      at: 1000,
    });

    expect(lost.aircraftByHex.size).toBe(0);
    expect(lost.messageLog).toHaveLength(1);
    expect(lost.messageLog[0]?.type).toBe('lost');
    expect(lost.newAndLostLog).toHaveLength(1);
    expect(lost.newAndLostLog[0]?.type).toBe('lost');
  });

  it('does not mutate the previous state object', () => {
    const first = aircraftStateReducer(initialAircraftState, {
      type: 'message',
      kind: 'new',
      aircraft: makeAircraft('A0B1C2'),
      at: 1000,
    });

    aircraftStateReducer(first, {
      type: 'message',
      kind: 'new',
      aircraft: makeAircraft('D3E4F5'),
      at: 2000,
    });

    expect(first.aircraftByHex.size).toBe(1);
  });

  describe('messageLog', () => {
    it('records new, update, and lost events with their kind, hex, callsign, and timestamp', () => {
      const afterNew = aircraftStateReducer(initialAircraftState, {
        type: 'message',
        kind: 'new',
        aircraft: makeAircraft('A0B1C2', { callsign: 'UAL123' }),
        at: 1000,
      });
      const afterUpdate = aircraftStateReducer(afterNew, {
        type: 'message',
        kind: 'update',
        aircraft: makeAircraft('A0B1C2', { callsign: 'UAL123' }),
        at: 2000,
      });
      const afterLost = aircraftStateReducer(afterUpdate, {
        type: 'lost',
        icaoHex: 'A0B1C2',
        callsign: 'UAL123',
        at: 3000,
      });

      expect(afterLost.messageLog).toEqual([
        { id: 0, type: 'new', icaoHex: 'A0B1C2', callsign: 'UAL123', at: 1000 },
        { id: 1, type: 'update', icaoHex: 'A0B1C2', callsign: 'UAL123', at: 2000 },
        { id: 2, type: 'lost', icaoHex: 'A0B1C2', callsign: 'UAL123', at: 3000 },
      ]);
    });

    it('keeps ids stable and monotonically increasing once entries are trimmed', () => {
      let state = initialAircraftState;
      for (let i = 0; i < 205; i += 1) {
        state = aircraftStateReducer(state, {
          type: 'message',
          kind: 'update',
          aircraft: makeAircraft('A0B1C2'),
          at: i,
        });
      }

      expect(state.messageLog).toHaveLength(200);
      expect(state.messageLog[0]?.id).toBe(5);
      expect(state.messageLog[199]?.id).toBe(204);
      expect(state.nextLogId).toBe(205);
    });
  });

  describe('newAndLostLog', () => {
    it('records new and lost events but not updates', () => {
      const afterNew = aircraftStateReducer(initialAircraftState, {
        type: 'message',
        kind: 'new',
        aircraft: makeAircraft('A0B1C2', { callsign: 'UAL123' }),
        at: 1000,
      });
      const afterUpdate = aircraftStateReducer(afterNew, {
        type: 'message',
        kind: 'update',
        aircraft: makeAircraft('A0B1C2', { callsign: 'UAL123' }),
        at: 2000,
      });
      const afterLost = aircraftStateReducer(afterUpdate, {
        type: 'lost',
        icaoHex: 'A0B1C2',
        callsign: 'UAL123',
        at: 3000,
      });

      expect(afterLost.newAndLostLog).toEqual([
        { id: 0, type: 'new', icaoHex: 'A0B1C2', callsign: 'UAL123', at: 1000 },
        { id: 2, type: 'lost', icaoHex: 'A0B1C2', callsign: 'UAL123', at: 3000 },
      ]);
    });

    it('is not evicted by high-frequency updates the way a shared log would be', () => {
      // Regression test: a single combined log capped at 200 entries would
      // have this original "new" event pushed out by the 250 updates that
      // follow, even though a new/lost-only view of the same feed activity
      // would consider that "new" event still the most recent one worth
      // showing. Keeping newAndLostLog separate is the fix.
      let state = aircraftStateReducer(initialAircraftState, {
        type: 'message',
        kind: 'new',
        aircraft: makeAircraft('A0B1C2'),
        at: 0,
      });
      for (let i = 0; i < 250; i += 1) {
        state = aircraftStateReducer(state, {
          type: 'message',
          kind: 'update',
          aircraft: makeAircraft('A0B1C2'),
          at: i + 1,
        });
      }

      expect(state.messageLog.some((entry) => entry.type === 'new')).toBe(false);
      expect(state.newAndLostLog).toEqual([
        { id: 0, type: 'new', icaoHex: 'A0B1C2', callsign: undefined, at: 0 },
      ]);
    });

    it('caps independently of messageLog, keeping ids stable once trimmed', () => {
      let state = initialAircraftState;
      for (let i = 0; i < 205; i += 1) {
        state = aircraftStateReducer(state, {
          type: 'lost',
          icaoHex: 'A0B1C2',
          callsign: undefined,
          at: i,
        });
      }

      expect(state.newAndLostLog).toHaveLength(200);
      expect(state.newAndLostLog[0]?.id).toBe(5);
      expect(state.newAndLostLog[199]?.id).toBe(204);
    });
  });
});
