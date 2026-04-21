import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseCsvLine } from './parse-csv.js';

describe('parseCsvLine', () => {
  it('strips quotes from quoted fields', () => {
    assert.deepEqual(parseCsvLine('"a","b","c"'), ['a', 'b', 'c']);
  });

  it('handles unquoted numeric fields', () => {
    assert.deepEqual(parseCsvLine('"ID",1,"State"'), ['ID', '1', 'State']);
  });

  it('preserves commas inside quoted fields', () => {
    assert.deepEqual(parseCsvLine('"a,b","c"'), ['a,b', 'c']);
  });

  it('unescapes doubled double-quotes', () => {
    assert.deepEqual(parseCsvLine('"he said ""hi"""'), ['he said "hi"']);
  });

  it('handles trailing empty field', () => {
    assert.deepEqual(parseCsvLine('A,B,'), ['A', 'B', '']);
  });

  it('returns a single empty field for empty input', () => {
    assert.deepEqual(parseCsvLine(''), ['']);
  });
});

describe('parseCsv', () => {
  it('keys records by header', () => {
    const records = parseCsv('"ID","NAME"\n"ABC","FOO"\n');
    assert.deepEqual(records, [{ ID: 'ABC', NAME: 'FOO' }]);
  });

  it('omits empty cell values', () => {
    const records = parseCsv('"A","B","C"\n"x","","z"\n');
    assert.deepEqual(records[0], { A: 'x', C: 'z' });
  });

  it('returns [] for empty input or header-only input', () => {
    assert.deepEqual(parseCsv(''), []);
    assert.deepEqual(parseCsv('"A","B"\n'), []);
  });

  it('handles CRLF line endings', () => {
    const records = parseCsv('"A","B"\r\n"x","y"\r\n');
    assert.deepEqual(records, [{ A: 'x', B: 'y' }]);
  });
});
