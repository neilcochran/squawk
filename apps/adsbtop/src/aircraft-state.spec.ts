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
      aircraft: makeAircraft('A0B1C2', { callsign: 'UAL123' }),
      at: 1000,
    });
    const second = aircraftStateReducer(first, {
      type: 'message',
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
      aircraft: makeAircraft('A0B1C2'),
      at: 1000,
    });
    const lost = aircraftStateReducer(tracked, { type: 'lost', icaoHex: 'A0B1C2' });

    expect(lost.aircraftByHex.has('A0B1C2')).toBe(false);
    expect(lost.messageCount).toBe(1);
  });

  it('returns the same state reference for a lost action on an unknown icaoHex', () => {
    const lost = aircraftStateReducer(initialAircraftState, { type: 'lost', icaoHex: 'FFFFFF' });

    expect(lost).toBe(initialAircraftState);
  });

  it('does not mutate the previous state object', () => {
    const first = aircraftStateReducer(initialAircraftState, {
      type: 'message',
      aircraft: makeAircraft('A0B1C2'),
      at: 1000,
    });

    aircraftStateReducer(first, { type: 'message', aircraft: makeAircraft('D3E4F5'), at: 2000 });

    expect(first.aircraftByHex.size).toBe(1);
  });
});
