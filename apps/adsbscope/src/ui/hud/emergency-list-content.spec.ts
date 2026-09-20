import { describe, expect, it } from 'vitest';

import { makeSnapshot, makeTarget } from '../scope/test-utils.js';

import { buildEmergencyList } from './emergency-list-content.js';

describe('buildEmergencyList', () => {
  it('is empty before the first snapshot, and while nothing is in an emergency', () => {
    expect(buildEmergencyList(undefined)).toEqual([]);
    expect(buildEmergencyList(makeSnapshot([makeTarget({ squawk: '1200' })]))).toEqual([]);
  });

  it('lists only the aircraft in an emergency, with their code and squawk', () => {
    const snapshot = makeSnapshot([
      makeTarget({ icaoHex: 'a00001', callsign: 'UAL123', squawk: '7700', emergency: 'general' }),
      makeTarget({ icaoHex: 'a00002', callsign: 'DAL45', squawk: '1200' }),
    ]);

    expect(buildEmergencyList(snapshot)).toEqual([
      { icaoHex: 'a00001', identity: 'UAL123 EM', squawk: '7700' },
    ]);
  });

  it('lists an aircraft with no position, or no squawk, just the same', () => {
    const snapshot = makeSnapshot([makeTarget({ icaoHex: 'c0ffee', emergency: 'minimumFuel' })]);

    expect(buildEmergencyList(snapshot)).toEqual([
      { icaoHex: 'c0ffee', identity: 'C0FFEE FUEL', squawk: undefined },
    ]);
  });

  it('orders rows by identity, so they hold still between snapshots', () => {
    const targets = [
      makeTarget({ icaoHex: 'a00003', callsign: 'UAL9', emergency: 'general' }),
      makeTarget({ icaoHex: 'a00002', callsign: 'AAL7', emergency: 'general' }),
      makeTarget({ icaoHex: 'a00001', callsign: 'AAL7', emergency: 'general' }),
    ];

    const forwards = buildEmergencyList(makeSnapshot(targets));
    const backwards = buildEmergencyList(makeSnapshot([...targets].reverse()));

    expect(forwards.map((row) => row.icaoHex)).toEqual(['a00001', 'a00002', 'a00003']);
    expect(backwards).toEqual(forwards);
  });
});
