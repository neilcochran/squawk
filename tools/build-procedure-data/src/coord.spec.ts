import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArincLatitude, parseArincLongitude } from './coord.js';

describe('parseArincLatitude', () => {
  it('parses a northern hemisphere latitude', () => {
    // KJFK airport reference point: N40° 38' 23.74"
    const result = parseArincLatitude('N40382374');
    assert.ok(result !== undefined);
    assert.ok(Math.abs(result - 40.639928) < 1e-5);
  });

  it('parses a southern hemisphere latitude as negative', () => {
    // American Samoa NSTU: S14° 19' 47.xx"
    const result = parseArincLatitude('S14194700');
    assert.ok(result !== undefined);
    assert.ok(result < 0);
    assert.ok(Math.abs(Math.abs(result) - 14.32964) < 1e-4);
  });

  it('parses the equator', () => {
    const result = parseArincLatitude('N00000000');
    assert.equal(result, 0);
  });

  it('parses near the north pole', () => {
    const result = parseArincLatitude('N89595999');
    assert.ok(result !== undefined);
    assert.ok(result > 89.99 && result < 90);
  });

  it('returns undefined for an invalid hemisphere character', () => {
    assert.equal(parseArincLatitude('X40382374'), undefined);
  });

  it('returns undefined for a blank slice', () => {
    assert.equal(parseArincLatitude('         '), undefined);
  });

  it('returns undefined when shorter than 9 characters', () => {
    assert.equal(parseArincLatitude('N4038237'), undefined);
  });

  it('returns undefined when the numeric body is non-numeric', () => {
    assert.equal(parseArincLatitude('N403XXXX4'), undefined);
  });

  it('rounds to 6 decimal places', () => {
    // Verify the output is not overly precise
    const result = parseArincLatitude('N40382374');
    assert.ok(result !== undefined);
    const str = String(result);
    const decimals = str.includes('.') ? str.split('.')[1]!.length : 0;
    assert.ok(decimals <= 6);
  });
});

describe('parseArincLongitude', () => {
  it('parses a western hemisphere longitude as negative', () => {
    // KJFK: W073° 46' 43.2"
    const result = parseArincLongitude('W073464320');
    assert.ok(result !== undefined);
    assert.ok(result < 0);
    assert.ok(Math.abs(Math.abs(result) - 73.7787) < 1e-3);
  });

  it('parses an eastern hemisphere longitude as positive', () => {
    // Guam PGUM: E144° 48' 0x.xx"
    const result = parseArincLongitude('E144475900');
    assert.ok(result !== undefined);
    assert.ok(result > 144 && result < 145);
  });

  it('parses the prime meridian', () => {
    const result = parseArincLongitude('E000000000');
    assert.equal(result, 0);
  });

  it('parses near the international date line (east)', () => {
    const result = parseArincLongitude('E179595999');
    assert.ok(result !== undefined);
    assert.ok(result > 179.99 && result < 180);
  });

  it('parses near the international date line (west)', () => {
    const result = parseArincLongitude('W179595999');
    assert.ok(result !== undefined);
    assert.ok(result < -179.99 && result > -180);
  });

  it('returns undefined for an invalid hemisphere character', () => {
    assert.equal(parseArincLongitude('X073464320'), undefined);
  });

  it('returns undefined for a blank slice', () => {
    assert.equal(parseArincLongitude('          '), undefined);
  });

  it('returns undefined when shorter than 10 characters', () => {
    assert.equal(parseArincLongitude('W07346432'), undefined);
  });

  it('returns undefined when the numeric body is non-numeric', () => {
    assert.equal(parseArincLongitude('W07XXXX320'), undefined);
  });
});
