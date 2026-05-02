import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { extractCycleDate } from './fetch-cifp.js';

describe('extractCycleDate', () => {
  it('extracts the date from a canonical FAACIFP18 header line', () => {
    const header = 'HDR01FAACIFP18      001P013203974102604  25-MAR-202612:51:00  U.S.A. DOT FAA';
    assert.equal(extractCycleDate(header), '2026-03-25');
  });

  it('parses all twelve month abbreviations', () => {
    const cases: Array<[string, string]> = [
      ['01-JAN-2026', '2026-01-01'],
      ['15-FEB-2026', '2026-02-15'],
      ['31-MAR-2026', '2026-03-31'],
      ['01-APR-2026', '2026-04-01'],
      ['12-MAY-2026', '2026-05-12'],
      ['20-JUN-2026', '2026-06-20'],
      ['04-JUL-2026', '2026-07-04'],
      ['08-AUG-2026', '2026-08-08'],
      ['15-SEP-2026', '2026-09-15'],
      ['31-OCT-2026', '2026-10-31'],
      ['11-NOV-2026', '2026-11-11'],
      ['25-DEC-2026', '2026-12-25'],
    ];
    for (const [input, expected] of cases) {
      assert.equal(extractCycleDate(`HDR01 ${input} junk`), expected);
    }
  });

  it('only inspects the first 200 bytes of the contents', () => {
    // A valid-looking date past the 200-byte mark must not be matched.
    const body = ' '.repeat(500) + '01-FEB-2030';
    assert.throws(() => extractCycleDate(body), /Could not extract/);
  });

  it('throws when the contents contain no recognized date pattern', () => {
    assert.throws(() => extractCycleDate('HDR01 no date here'), /Could not extract/);
  });

  it('throws when the month abbreviation is unrecognized', () => {
    assert.throws(() => extractCycleDate('HDR01 25-FOO-2026'), /Unrecognized month abbreviation/);
  });
});
