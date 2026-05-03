import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, beforeEach, afterEach, expect } from 'vitest';

import { loadAirportStates } from './load-airport-states.js';

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'load-airport-states-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('loadAirportStates', () => {
  it('maps ARPT_ID to STATE_CODE', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(
      csvPath,
      '"ARPT_ID","ARPT_NAME","STATE_CODE"\n' +
        '"JFK","JOHN F KENNEDY INTL","NY"\n' +
        '"LAX","LOS ANGELES INTL","CA"\n' +
        '"ORD","CHICAGO OHARE INTL","IL"\n',
      'utf-8',
    );

    const map = await loadAirportStates(csvPath);
    expect(map.size).toBe(3);
    expect(map.get('JFK')).toBe('NY');
    expect(map.get('LAX')).toBe('CA');
    expect(map.get('ORD')).toBe('IL');
  });

  it('throws when required columns are missing', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(csvPath, '"FOO","BAR"\n"A","B"\n', 'utf-8');
    await expect(loadAirportStates(csvPath)).rejects.toThrow(/missing expected columns/);
  });

  it('skips rows with blank ARPT_ID or STATE_CODE', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(
      csvPath,
      '"ARPT_ID","STATE_CODE"\n' + '"BOS","MA"\n' + '"","XX"\n' + '"NOSTATE",""\n',
      'utf-8',
    );

    const map = await loadAirportStates(csvPath);
    expect(map.size).toBe(1);
    expect(map.get('BOS')).toBe('MA');
  });

  it('tolerates extra columns and finds the right indices by header name', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(
      csvPath,
      '"EXTRA","STATE_CODE","OTHER","ARPT_ID","TRAILING"\n' + '"x","TX","y","AUS","z"\n',
      'utf-8',
    );

    const map = await loadAirportStates(csvPath);
    expect(map.get('AUS')).toBe('TX');
  });

  it('returns an empty map for a header-only file', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(csvPath, '"ARPT_ID","STATE_CODE"\n', 'utf-8');
    const map = await loadAirportStates(csvPath);
    expect(map.size).toBe(0);
  });

  it('skips blank lines in the middle of the file', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(
      csvPath,
      '"ARPT_ID","STATE_CODE"\n' + '\n' + '   \n' + '"BOS","MA"\n' + '\n' + '"AUS","TX"\n',
      'utf-8',
    );
    const map = await loadAirportStates(csvPath);
    expect(map.size).toBe(2);
    expect(map.get('BOS')).toBe('MA');
    expect(map.get('AUS')).toBe('TX');
  });
});
