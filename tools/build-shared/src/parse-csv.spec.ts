import { describe, it, expect } from 'vitest';

import { parseCsv, parseCsvLine } from './parse-csv.js';

describe('parseCsvLine', () => {
  it('splits a simple unquoted line on commas', () => {
    const fields = parseCsvLine('A,B,C,D');
    expect(fields).toEqual(['A', 'B', 'C', 'D']);
  });

  it('strips quotes from quoted fields', () => {
    const fields = parseCsvLine('"foo","bar","baz"');
    expect(fields).toEqual(['foo', 'bar', 'baz']);
  });

  it('handles a mix of quoted and unquoted fields', () => {
    const fields = parseCsvLine('"JFK",123,"NEW YORK",40.6398');
    expect(fields).toEqual(['JFK', '123', 'NEW YORK', '40.6398']);
  });

  it('preserves commas inside quoted fields', () => {
    const fields = parseCsvLine('"JFK","NEW YORK, NY","USA"');
    expect(fields).toEqual(['JFK', 'NEW YORK, NY', 'USA']);
  });

  it('unescapes double-quoted escape sequences inside quoted fields', () => {
    const fields = parseCsvLine('"contains ""quotes"" inside","plain"');
    expect(fields).toEqual(['contains "quotes" inside', 'plain']);
  });

  it('returns a trailing empty field when the line ends with a comma', () => {
    const fields = parseCsvLine('A,B,');
    expect(fields).toEqual(['A', 'B', '']);
  });

  it('handles an empty string', () => {
    const fields = parseCsvLine('');
    expect(fields).toEqual(['']);
  });

  it('returns the single field for an unquoted value with no commas', () => {
    const fields = parseCsvLine('single');
    expect(fields).toEqual(['single']);
  });

  it('preserves leading/trailing whitespace inside quoted fields', () => {
    const fields = parseCsvLine('"  spaced  ","nope"');
    expect(fields).toEqual(['  spaced  ', 'nope']);
  });

  it('strips a leading UTF-8 BOM before splitting', () => {
    const fields = parseCsvLine('\uFEFF"EFF_DATE","LOCATION_ID"');
    expect(fields).toEqual(['EFF_DATE', 'LOCATION_ID']);
  });
});

describe('parseCsv', () => {
  it('parses a complete CSV into records keyed by column name', () => {
    const text = '"ID","NAME","STATE"\n"JFK","KENNEDY","NY"\n"LAX","LOS ANGELES","CA"\n';
    const records = parseCsv(text);
    expect(records.length).toBe(2);
    expect(records[0]).toEqual({ ID: 'JFK', NAME: 'KENNEDY', STATE: 'NY' });
    expect(records[1]).toEqual({ ID: 'LAX', NAME: 'LOS ANGELES', STATE: 'CA' });
  });

  it('omits empty / blank field values from records', () => {
    const text = '"A","B","C"\n"x","","z"\n';
    const records = parseCsv(text);
    expect(records[0]).toEqual({ A: 'x', C: 'z' });
  });

  it('trims whitespace from field values', () => {
    const text = '"A","B"\n"  padded  ","  other  "\n';
    const records = parseCsv(text);
    expect(records[0]).toEqual({ A: 'padded', B: 'other' });
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });

  it('returns no records when only the header is present', () => {
    const records = parseCsv('"A","B","C"\n');
    expect(records).toEqual([]);
  });

  it('handles both LF and CRLF line endings', () => {
    const text = '"A","B"\r\n"x","y"\r\n"p","q"\r\n';
    const records = parseCsv(text);
    expect(records.length).toBe(2);
    expect(records[0]).toEqual({ A: 'x', B: 'y' });
  });

  it('skips completely blank lines', () => {
    const text = '"A","B"\n\n"x","y"\n   \n';
    const records = parseCsv(text);
    expect(records.length).toBe(1);
    expect(records[0]).toEqual({ A: 'x', B: 'y' });
  });
});
