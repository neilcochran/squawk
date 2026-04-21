import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    assert.equal(map.size, 3);
    assert.equal(map.get('JFK'), 'NY');
    assert.equal(map.get('LAX'), 'CA');
    assert.equal(map.get('ORD'), 'IL');
  });

  it('throws when required columns are missing', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(csvPath, '"FOO","BAR"\n"A","B"\n', 'utf-8');
    await assert.rejects(loadAirportStates(csvPath), /missing expected columns/);
  });

  it('skips rows with blank ARPT_ID or STATE_CODE', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(
      csvPath,
      '"ARPT_ID","STATE_CODE"\n' + '"BOS","MA"\n' + '"","XX"\n' + '"NOSTATE",""\n',
      'utf-8',
    );

    const map = await loadAirportStates(csvPath);
    assert.equal(map.size, 1);
    assert.equal(map.get('BOS'), 'MA');
  });

  it('tolerates extra columns and finds the right indices by header name', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(
      csvPath,
      '"EXTRA","STATE_CODE","OTHER","ARPT_ID","TRAILING"\n' + '"x","TX","y","AUS","z"\n',
      'utf-8',
    );

    const map = await loadAirportStates(csvPath);
    assert.equal(map.get('AUS'), 'TX');
  });

  it('returns an empty map for a header-only file', async () => {
    const csvPath = join(sandbox, 'APT_BASE.csv');
    writeFileSync(csvPath, '"ARPT_ID","STATE_CODE"\n', 'utf-8');
    const map = await loadAirportStates(csvPath);
    assert.equal(map.size, 0);
  });
});
