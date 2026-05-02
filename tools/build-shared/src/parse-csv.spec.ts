import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseCsv, parseCsvLine } from './parse-csv.js';

describe('parseCsvLine', () => {
  it('splits a simple unquoted line on commas', () => {
    const fields = parseCsvLine('A,B,C,D');
    assert.deepEqual(fields, ['A', 'B', 'C', 'D']);
  });

  it('strips quotes from quoted fields', () => {
    const fields = parseCsvLine('"foo","bar","baz"');
    assert.deepEqual(fields, ['foo', 'bar', 'baz']);
  });

  it('handles a mix of quoted and unquoted fields', () => {
    const fields = parseCsvLine('"JFK",123,"NEW YORK",40.6398');
    assert.deepEqual(fields, ['JFK', '123', 'NEW YORK', '40.6398']);
  });

  it('preserves commas inside quoted fields', () => {
    const fields = parseCsvLine('"JFK","NEW YORK, NY","USA"');
    assert.deepEqual(fields, ['JFK', 'NEW YORK, NY', 'USA']);
  });

  it('unescapes double-quoted escape sequences inside quoted fields', () => {
    const fields = parseCsvLine('"contains ""quotes"" inside","plain"');
    assert.deepEqual(fields, ['contains "quotes" inside', 'plain']);
  });

  it('returns a trailing empty field when the line ends with a comma', () => {
    const fields = parseCsvLine('A,B,');
    assert.deepEqual(fields, ['A', 'B', '']);
  });

  it('handles an empty string', () => {
    const fields = parseCsvLine('');
    assert.deepEqual(fields, ['']);
  });

  it('returns the single field for an unquoted value with no commas', () => {
    const fields = parseCsvLine('single');
    assert.deepEqual(fields, ['single']);
  });

  it('preserves leading/trailing whitespace inside quoted fields', () => {
    const fields = parseCsvLine('"  spaced  ","nope"');
    assert.deepEqual(fields, ['  spaced  ', 'nope']);
  });

  it('strips a leading UTF-8 BOM before splitting', () => {
    const fields = parseCsvLine('\uFEFF"EFF_DATE","LOCATION_ID"');
    assert.deepEqual(fields, ['EFF_DATE', 'LOCATION_ID']);
  });
});

describe('parseCsv', () => {
  it('parses a complete CSV into records keyed by column name', () => {
    const text = '"ID","NAME","STATE"\n"JFK","KENNEDY","NY"\n"LAX","LOS ANGELES","CA"\n';
    const records = parseCsv(text);
    assert.equal(records.length, 2);
    assert.deepEqual(records[0], { ID: 'JFK', NAME: 'KENNEDY', STATE: 'NY' });
    assert.deepEqual(records[1], { ID: 'LAX', NAME: 'LOS ANGELES', STATE: 'CA' });
  });

  it('omits empty / blank field values from records', () => {
    const text = '"A","B","C"\n"x","","z"\n';
    const records = parseCsv(text);
    assert.deepEqual(records[0], { A: 'x', C: 'z' });
  });

  it('trims whitespace from field values', () => {
    const text = '"A","B"\n"  padded  ","  other  "\n';
    const records = parseCsv(text);
    assert.deepEqual(records[0], { A: 'padded', B: 'other' });
  });

  it('returns an empty array for empty input', () => {
    assert.deepEqual(parseCsv(''), []);
    assert.deepEqual(parseCsv('\n\n'), []);
  });

  it('returns no records when only the header is present', () => {
    const records = parseCsv('"A","B","C"\n');
    assert.deepEqual(records, []);
  });

  it('handles both LF and CRLF line endings', () => {
    const text = '"A","B"\r\n"x","y"\r\n"p","q"\r\n';
    const records = parseCsv(text);
    assert.equal(records.length, 2);
    assert.deepEqual(records[0], { A: 'x', B: 'y' });
  });

  it('skips completely blank lines', () => {
    const text = '"A","B"\n\n"x","y"\n   \n';
    const records = parseCsv(text);
    assert.equal(records.length, 1);
    assert.deepEqual(records[0], { A: 'x', B: 'y' });
  });
});
