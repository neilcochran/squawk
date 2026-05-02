import { describe, it, beforeEach, afterEach, expect, assert } from 'vitest';
import { lookupCode } from './lookup-code.js';

const originalWarn = console.warn;
let warnings: string[];

beforeEach(() => {
  warnings = [];
  console.warn = (msg: string) => {
    warnings.push(msg);
  };
});

afterEach(() => {
  console.warn = originalWarn;
});

describe('lookupCode', () => {
  it('returns the mapped value for a known code', () => {
    const map = { A: 'AIRPORT', H: 'HELIPORT' };
    const result = lookupCode(map, 'A', 'SITE_TYPE_CODE', 'test-context');
    expect(result).toBe('AIRPORT');
    expect(warnings.length).toBe(0);
  });

  it('returns undefined for an unknown code', () => {
    const map = { A: 'AIRPORT' };
    const result = lookupCode(map, 'Z', 'SITE_TYPE_CODE_1', 'test-context');
    expect(result).toBe(undefined);
  });

  it('warns on the first unknown code with the context and map name', () => {
    const map: Record<string, string> = {};
    lookupCode(map, 'X', 'SITE_TYPE_CODE_2', 'parse-airports');
    expect(warnings.length).toBe(1);
    const warning = warnings[0] ?? '';
    assert(warning.includes('parse-airports'));
    assert(warning.includes('SITE_TYPE_CODE_2'));
    assert(warning.includes('"X"'));
  });

  it('deduplicates warnings for the same code in the same map', () => {
    const map: Record<string, string> = {};
    lookupCode(map, 'Y', 'SITE_TYPE_CODE_3', 'test-ctx');
    lookupCode(map, 'Y', 'SITE_TYPE_CODE_3', 'test-ctx');
    lookupCode(map, 'Y', 'SITE_TYPE_CODE_3', 'test-ctx');
    expect(warnings.length).toBe(1);
  });

  it('emits a separate warning for a different code in the same map', () => {
    const map: Record<string, string> = {};
    lookupCode(map, 'A', 'SITE_TYPE_CODE_4', 'test-ctx');
    lookupCode(map, 'B', 'SITE_TYPE_CODE_4', 'test-ctx');
    expect(warnings.length).toBe(2);
  });

  it('tracks warnings independently per map name', () => {
    const map: Record<string, string> = {};
    lookupCode(map, 'Z', 'MAP_A_5', 'test-ctx');
    lookupCode(map, 'Z', 'MAP_B_5', 'test-ctx');
    expect(warnings.length).toBe(2);
  });

  it('preserves generic value types from the map', () => {
    const map: Record<string, number> = { one: 1, two: 2 };
    const result = lookupCode(map, 'two', 'NUM_MAP', 'test-ctx');
    expect(result).toBe(2);
  });
});
