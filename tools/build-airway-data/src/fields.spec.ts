import { describe, it, expect, assert } from 'vitest';

import {
  crossingAltitudePointField,
  directionField,
  field,
  intField,
  magneticVariationField,
  numField,
  parseDms,
  strField,
} from './fields.js';
import { fixedWidthLine } from './test-utils.js';

describe('field helpers', () => {
  const line = fixedWidthLine([
    { col: 5, len: 5, value: 'V16' },
    { col: 11, len: 6, value: ' 45.50' },
    { col: 21, len: 5, value: '04000' },
    { col: 31, len: 5, value: 'XXXXX' },
  ]);

  it('field trims the substring at a 1-based column', () => {
    expect(field(line, 5, 5)).toBe('V16');
    expect(field(line, 41, 5)).toBe('');
  });

  it('numField and intField parse numbers and return undefined for blank or non-numeric text', () => {
    expect(numField(line, 11, 6)).toBe(45.5);
    expect(intField(line, 21, 5)).toBe(4000);
    expect(numField(line, 41, 6)).toBe(undefined);
    expect(intField(line, 41, 5)).toBe(undefined);
    expect(numField(line, 31, 5)).toBe(undefined);
    expect(intField(line, 31, 5)).toBe(undefined);
  });

  it('strField returns undefined for a blank field', () => {
    expect(strField(line, 5, 5)).toBe('V16');
    expect(strField(line, 41, 5)).toBe(undefined);
  });
});

describe('directionField', () => {
  it('accepts the eight compass forms', () => {
    for (const direction of [
      'N BND',
      'NE BND',
      'E BND',
      'SE BND',
      'S BND',
      'SW BND',
      'W BND',
      'NW BND',
    ]) {
      const line = fixedWidthLine([{ col: 80, len: 7, value: direction }]);
      expect(directionField(line, 80, 7)).toBe(direction);
    }
  });

  it('drops the bare BND template NASR writes where no direction applies', () => {
    const line = fixedWidthLine([{ col: 80, len: 6, value: '  BND ' }]);
    expect(directionField(line, 80, 6)).toBe(undefined);
  });

  it('returns undefined for blank and unknown values', () => {
    expect(directionField(fixedWidthLine([]), 80, 6)).toBe(undefined);
    expect(directionField(fixedWidthLine([{ col: 80, len: 6, value: 'NE-SW' }]), 80, 6)).toBe(
      undefined,
    );
  });
});

describe('magneticVariationField', () => {
  it('parses degrees and direction from the right-justified field', () => {
    expect(
      magneticVariationField(fixedWidthLine([{ col: 137, len: 5, value: '  08E' }]), 137, 5),
    ).toEqual({
      degrees: 8,
      direction: 'E',
    });
    expect(
      magneticVariationField(fixedWidthLine([{ col: 137, len: 5, value: '  12W' }]), 137, 5),
    ).toEqual({
      degrees: 12,
      direction: 'W',
    });
  });

  it('returns undefined for blank or malformed values', () => {
    expect(magneticVariationField(fixedWidthLine([]), 137, 5)).toBe(undefined);
    expect(
      magneticVariationField(fixedWidthLine([{ col: 137, len: 5, value: '  08X' }]), 137, 5),
    ).toBe(undefined);
    expect(
      magneticVariationField(fixedWidthLine([{ col: 137, len: 5, value: 'EIGHT' }]), 137, 5),
    ).toBe(undefined);
  });
});

describe('crossingAltitudePointField', () => {
  it('returns the point name between the asterisks', () => {
    const line = fixedWidthLine([{ col: 240, len: 40, value: 'J70  *AUGER*WI' }]);
    expect(crossingAltitudePointField(line, 240, 40)).toBe('AUGER');
  });

  it('returns a navaid identifier written in the same form', () => {
    const line = fixedWidthLine([{ col: 240, len: 40, value: 'T245 *SMO*D' }]);
    expect(crossingAltitudePointField(line, 240, 40)).toBe('SMO');
  });

  it('returns undefined for a blank field or one without a starred name', () => {
    expect(crossingAltitudePointField(fixedWidthLine([]), 240, 40)).toBe(undefined);
    expect(
      crossingAltitudePointField(
        fixedWidthLine([{ col: 240, len: 40, value: 'J70  AUGER' }]),
        240,
        40,
      ),
    ).toBe(undefined);
    expect(
      crossingAltitudePointField(fixedWidthLine([{ col: 240, len: 40, value: '**' }]), 240, 40),
    ).toBe(undefined);
  });
});

describe('parseDms', () => {
  it('parses a northern latitude as positive decimal degrees', () => {
    const result = parseDms('32-32-25.59N');
    assert(result !== undefined);
    assert(Math.abs(result - 32.54044) < 1e-4);
  });

  it('parses a western longitude as negative decimal degrees', () => {
    const result = parseDms('116-57-09.72W');
    assert(result !== undefined);
    assert(result < 0);
    assert(Math.abs(Math.abs(result) - 116.9527) < 1e-3);
  });

  it('parses a southern latitude as negative', () => {
    const result = parseDms('14-19-47.00S');
    assert(result !== undefined);
    assert(result < 0);
  });

  it('parses an eastern longitude as positive', () => {
    const result = parseDms('144-47-59.00E');
    assert(result !== undefined);
    assert(result > 144 && result < 145);
  });

  it('returns undefined for empty input', () => {
    expect(parseDms('')).toBe(undefined);
  });

  it('returns undefined for a malformed string', () => {
    expect(parseDms('nope')).toBe(undefined);
    expect(parseDms('32-32N')).toBe(undefined);
  });

  it('rounds to 6 decimal places', () => {
    const result = parseDms('32-32-25.59N');
    assert(result !== undefined);
    const str = String(result);
    const decimals = str.includes('.') ? (str.split('.')[1]?.length ?? 0) : 0;
    assert(decimals <= 6);
  });
});
