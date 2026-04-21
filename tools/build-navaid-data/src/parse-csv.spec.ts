import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseCsvLine } from './parse-csv.js';

describe('parseCsvLine', () => {
  it('strips quotes from quoted fields', () => {
    assert.deepEqual(parseCsvLine('"a","b","c"'), ['a', 'b', 'c']);
  });

  it('handles a mix of quoted and unquoted fields', () => {
    assert.deepEqual(parseCsvLine('"JFK",1,"NY"'), ['JFK', '1', 'NY']);
  });

  it('preserves commas and escape sequences in quoted fields', () => {
    assert.deepEqual(parseCsvLine('"a,b","c""d"'), ['a,b', 'c"d']);
  });

  it('returns a trailing empty string when the line ends with a comma', () => {
    assert.deepEqual(parseCsvLine('A,B,'), ['A', 'B', '']);
  });

  it('handles empty input', () => {
    assert.deepEqual(parseCsvLine(''), ['']);
  });
});

describe('parseCsv', () => {
  it('produces records keyed by header', () => {
    const text = '"A","B"\n"1","2"\n';
    const records = parseCsv(text);
    assert.deepEqual(records, [{ A: '1', B: '2' }]);
  });

  it('skips blank and whitespace-only lines', () => {
    const text = '"A","B"\n\n"x","y"\n   \n';
    const records = parseCsv(text);
    assert.equal(records.length, 1);
  });

  it('omits empty cell values from records', () => {
    const records = parseCsv('"A","B","C"\n"x","","z"\n');
    assert.deepEqual(records[0], { A: 'x', C: 'z' });
  });

  it('returns [] for an empty input', () => {
    assert.deepEqual(parseCsv(''), []);
  });
});
