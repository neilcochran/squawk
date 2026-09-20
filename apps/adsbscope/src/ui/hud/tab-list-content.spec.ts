import { describe, expect, it } from 'vitest';

import { makeSnapshot, makeTarget } from '../scope/test-utils.js';

import { buildTabList, TAB_LIST_MAX_ROWS } from './tab-list-content.js';

const PLOTTED = makeTarget({
  icaoHex: 'a00001',
  callsign: 'UAL123',
  position: { trueBearingDeg: 90, rangeNm: 10 },
});

describe('buildTabList', () => {
  it('is empty before the first snapshot, and when every aircraft is plotted', () => {
    expect(buildTabList(undefined)).toEqual({ rows: [], hiddenCount: 0 });
    expect(buildTabList(makeSnapshot([PLOTTED]))).toEqual({ rows: [], hiddenCount: 0 });
  });

  it('lists only the aircraft with no position, described as a data block would', () => {
    const unplotted = makeTarget({
      icaoHex: 'a00002',
      callsign: 'DAL45 ',
      altitudeFt: 12_000,
      groundSpeedKt: 300,
    });

    expect(buildTabList(makeSnapshot([PLOTTED, unplotted])).rows).toEqual([
      { icaoHex: 'a00002', identity: 'DAL45', detail: '120 30' },
    ]);
  });

  it('identifies an aircraft by its ICAO hex until it has sent a callsign', () => {
    expect(buildTabList(makeSnapshot([makeTarget({ icaoHex: 'c0ffee' })])).rows[0]?.identity).toBe(
      'C0FFEE',
    );
  });

  it('orders rows by identity, so they hold still between snapshots', () => {
    const targets = [
      makeTarget({ icaoHex: 'a00003', callsign: 'UAL9' }),
      makeTarget({ icaoHex: 'a00002', callsign: 'AAL7' }),
      makeTarget({ icaoHex: 'a00001', callsign: 'AAL7' }),
    ];

    const forwards = buildTabList(makeSnapshot(targets)).rows;
    const backwards = buildTabList(makeSnapshot([...targets].reverse())).rows;

    expect(forwards.map((row) => row.icaoHex)).toEqual(['a00001', 'a00002', 'a00003']);
    expect(backwards).toEqual(forwards);
  });

  it('names no more than the row limit, and counts the rest', () => {
    const targets = Array.from({ length: TAB_LIST_MAX_ROWS + 3 }, (_, index) =>
      makeTarget({ icaoHex: `a000${String(index).padStart(2, '0')}` }),
    );

    const atDefault = buildTabList(makeSnapshot(targets));
    const limitedToTwo = buildTabList(makeSnapshot(targets), 2);

    expect(atDefault.rows).toHaveLength(TAB_LIST_MAX_ROWS);
    expect(atDefault.hiddenCount).toBe(3);
    expect(limitedToTwo.rows).toHaveLength(2);
    expect(limitedToTwo.hiddenCount).toBe(TAB_LIST_MAX_ROWS + 1);
  });
});
