import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShapefileAltitude, normalizeSaaAltitude } from './normalize-altitude.js';

describe('normalizeShapefileAltitude', () => {
  it('normalizes SFC with zero value to SFC reference', () => {
    const result = normalizeShapefileAltitude('0', 'FT', 'SFC');
    assert.deepEqual(result, { valueFt: 0, reference: 'SFC' });
  });

  it('normalizes SFC with positive value as AGL', () => {
    const result = normalizeShapefileAltitude('700', 'FT', 'SFC');
    assert.deepEqual(result, { valueFt: 700, reference: 'AGL' });
  });

  it('treats null val as unlimited (99999 MSL)', () => {
    const result = normalizeShapefileAltitude(null, 'FT', 'MSL');
    assert.deepEqual(result, { valueFt: 99999, reference: 'MSL' });
  });

  it('treats the -9998 sentinel as unlimited (99999 MSL)', () => {
    const result = normalizeShapefileAltitude('-9998', 'FT', 'MSL');
    assert.deepEqual(result, { valueFt: 99999, reference: 'MSL' });
  });

  it('multiplies FL values by 100 to produce MSL feet', () => {
    const result = normalizeShapefileAltitude('180', 'FL', 'MSL');
    assert.deepEqual(result, { valueFt: 18000, reference: 'MSL' });
  });

  it('honors the AGL code', () => {
    const result = normalizeShapefileAltitude('1200', 'FT', 'AGL');
    assert.deepEqual(result, { valueFt: 1200, reference: 'AGL' });
  });

  it('defaults to MSL when code is not SFC/AGL and uom is not FL', () => {
    const result = normalizeShapefileAltitude('4800', 'FT', 'MSL');
    assert.deepEqual(result, { valueFt: 4800, reference: 'MSL' });
  });

  it('handles null code with a numeric value as MSL', () => {
    const result = normalizeShapefileAltitude('4800', 'FT', null);
    assert.deepEqual(result, { valueFt: 4800, reference: 'MSL' });
  });
});

describe('normalizeSaaAltitude', () => {
  it('normalizes SFC reference to zero SFC', () => {
    const result = normalizeSaaAltitude(0, 'FT', 'SFC');
    assert.deepEqual(result, { valueFt: 0, reference: 'SFC' });
  });

  it('treats the GND string value as SFC regardless of uom', () => {
    const result = normalizeSaaAltitude('GND', 'FT', '');
    assert.deepEqual(result, { valueFt: 0, reference: 'SFC' });
  });

  it('treats the UNL string value as unlimited (99999 MSL)', () => {
    const result = normalizeSaaAltitude('UNL', 'OTHER', 'OTHER');
    assert.deepEqual(result, { valueFt: 99999, reference: 'MSL' });
  });

  it('returns null for OTHER placeholders that are neither GND nor UNL', () => {
    assert.equal(normalizeSaaAltitude('NOTAM', 'OTHER', 'OTHER'), null);
    assert.equal(normalizeSaaAltitude(0, 'OTHER', 'MSL'), null);
    assert.equal(normalizeSaaAltitude(0, 'FT', 'OTHER'), null);
  });

  it('multiplies FL values by 100 regardless of reference', () => {
    assert.deepEqual(normalizeSaaAltitude(180, 'FL', 'STD'), {
      valueFt: 18000,
      reference: 'MSL',
    });
    assert.deepEqual(normalizeSaaAltitude(200, 'FL', ''), {
      valueFt: 20000,
      reference: 'MSL',
    });
  });

  it('honors AGL reference', () => {
    const result = normalizeSaaAltitude(1500, 'FT', 'AGL');
    assert.deepEqual(result, { valueFt: 1500, reference: 'AGL' });
  });

  it('defaults to MSL for FT + non-AGL references', () => {
    const result = normalizeSaaAltitude(3000, 'FT', 'MSL');
    assert.deepEqual(result, { valueFt: 3000, reference: 'MSL' });
  });

  it('parses numeric-string values', () => {
    const result = normalizeSaaAltitude('3000', 'FT', 'MSL');
    assert.deepEqual(result, { valueFt: 3000, reference: 'MSL' });
  });

  it('treats lowercase gnd/unl the same as uppercase (trim + upper)', () => {
    assert.deepEqual(normalizeSaaAltitude('gnd', 'FT', ''), {
      valueFt: 0,
      reference: 'SFC',
    });
    assert.deepEqual(normalizeSaaAltitude('  unl  ', 'OTHER', 'OTHER'), {
      valueFt: 99999,
      reference: 'MSL',
    });
  });
});
