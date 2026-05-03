import { describe, it, expect } from 'vitest';

import { encodeSelected, parseSelected } from './entity.ts';

describe('parseSelected', () => {
  it('returns undefined for an undefined input', () => {
    expect(parseSelected(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(parseSelected('')).toBeUndefined();
  });

  it('returns undefined for a value with no colon separator', () => {
    expect(parseSelected('airportBOS')).toBeUndefined();
  });

  it('returns undefined for a value starting with a colon (empty type)', () => {
    expect(parseSelected(':BOS')).toBeUndefined();
  });

  it('returns undefined for a value ending with a colon (empty id)', () => {
    expect(parseSelected('airport:')).toBeUndefined();
  });

  it('returns undefined for an unknown entity type prefix', () => {
    expect(parseSelected('runway:KBOS-04L')).toBeUndefined();
  });

  it('parses a valid airport reference', () => {
    expect(parseSelected('airport:BOS')).toEqual({ type: 'airport', id: 'BOS' });
  });

  it('parses a valid navaid reference', () => {
    expect(parseSelected('navaid:BOS')).toEqual({ type: 'navaid', id: 'BOS' });
  });

  it('parses a valid fix reference', () => {
    expect(parseSelected('fix:MERIT')).toEqual({ type: 'fix', id: 'MERIT' });
  });

  it('parses a valid airway reference', () => {
    expect(parseSelected('airway:V16')).toEqual({ type: 'airway', id: 'V16' });
  });

  it('preserves slash-bearing airspace compound ids in the id field', () => {
    expect(parseSelected('airspace:CLASS_B/JFK')).toEqual({
      type: 'airspace',
      id: 'CLASS_B/JFK',
    });
  });

  it('splits on the first colon only so embedded colons stay in the id', () => {
    expect(parseSelected('airspace:CLASS_E5/MULTI:PART')).toEqual({
      type: 'airspace',
      id: 'CLASS_E5/MULTI:PART',
    });
  });
});

describe('encodeSelected', () => {
  it('round-trips a parsed reference', () => {
    const ref = parseSelected('airport:BOS');
    expect(ref).toBeDefined();
    if (ref === undefined) {
      return;
    }
    expect(encodeSelected(ref)).toBe('airport:BOS');
  });

  it('encodes a compound airspace reference', () => {
    expect(encodeSelected({ type: 'airspace', id: 'CLASS_B/JFK' })).toBe('airspace:CLASS_B/JFK');
  });
});
