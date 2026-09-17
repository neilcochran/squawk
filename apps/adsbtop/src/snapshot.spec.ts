import { describe, expect, it } from 'vitest';

import type { Aircraft } from '@squawk/types';

import { availableColumns, selectColumns } from './columns.js';
import { buildSnapshotCsv, snapshotFileName } from './snapshot.js';

function makeAircraft(overrides: Partial<Aircraft> = {}): Aircraft {
  return { icaoHex: 'A0B1C2', lastSeenAt: 0, ...overrides };
}

describe('snapshotFileName', () => {
  it('stamps the file with the local date and time', () => {
    const at = new Date(2026, 8, 16, 9, 5, 7).getTime();
    expect(snapshotFileName(at)).toBe('adsbtop-20260916-090507.csv');
  });
});

describe('buildSnapshotCsv', () => {
  const columns = selectColumns(availableColumns({ source: 'beast', location: undefined }), [
    'icaoHex',
    'callsign',
    'altitude',
    'age',
  ]);

  it('writes a header row from the column headers and one row per aircraft as rendered', () => {
    const csv = buildSnapshotCsv(
      [
        makeAircraft({ callsign: 'UAL123', position: { lat: 0, lon: 0, baroAltitudeFt: 35_000 } }),
        makeAircraft({ icaoHex: 'D3E4F5', lastSeenAt: 0 }),
      ],
      columns,
      { nowMs: 5_000, location: undefined, units: 'aviation' },
    );

    expect(csv).toBe('ICAO,Callsign,Alt,Age\nA0B1C2,UAL123,35000ft,5s\nD3E4F5,-,-,5s\n');
  });

  it('quotes fields containing commas or quotes', () => {
    const csv = buildSnapshotCsv(
      [makeAircraft({ callsign: 'A,"B' })],
      selectColumns(availableColumns({ source: 'beast', location: undefined }), ['callsign']),
      { nowMs: 0, location: undefined, units: 'aviation' },
    );

    expect(csv).toBe('Callsign\n"A,""B"\n');
  });

  it('writes only the header for an empty table', () => {
    expect(
      buildSnapshotCsv([], columns, { nowMs: 0, location: undefined, units: 'aviation' }),
    ).toBe('ICAO,Callsign,Alt,Age\n');
  });
});
