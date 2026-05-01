import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArtcc } from './parse-artcc.js';

/**
 * Creates a temporary directory and returns its path plus a cleanup callback.
 *
 * @returns A tuple of the temporary directory path and a cleanup function.
 */
function makeTempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'parse-artcc-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('parseArtcc end-to-end', () => {
  it('parses a US ARTCC center with LOW and HIGH strata', async () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const arbBasePath = join(dir, 'ARB_BASE.csv');
      const arbSegPath = join(dir, 'ARB_SEG.csv');
      writeFileSync(
        arbBasePath,
        [
          'LOCATION_ID,LOCATION_NAME,COUNTRY_CODE,STATE',
          'ZNY,NEW YORK,US,NY',
          // Foreign center should be excluded
          'CZQM,MONCTON,CA,',
        ].join('\n'),
      );
      const seg = [
        'LOCATION_ID,ALTITUDE,TYPE,POINT_SEQ,LAT_DECIMAL,LONG_DECIMAL,BNDRY_PT_DESCRIP',
        // ZNY LOW - simple square
        'ZNY,LOW,ARTCC,1,40.0,-74.0,A',
        'ZNY,LOW,ARTCC,2,40.0,-73.0,B',
        'ZNY,LOW,ARTCC,3,41.0,-73.0,C',
        'ZNY,LOW,ARTCC,4,41.0,-74.0,D',
        'ZNY,LOW,ARTCC,5,40.0,-74.0,POINT OF BEGINNING',
        // ZNY HIGH - same square
        'ZNY,HIGH,ARTCC,1,40.0,-74.0,A',
        'ZNY,HIGH,ARTCC,2,40.0,-73.0,B',
        'ZNY,HIGH,ARTCC,3,41.0,-73.0,C',
        'ZNY,HIGH,ARTCC,4,41.0,-74.0,D',
        'ZNY,HIGH,ARTCC,5,40.0,-74.0,POINT OF BEGINNING',
        // Foreign center segments are filtered out via arbBase
        'CZQM,LOW,ARTCC,1,46.0,-66.0,A',
        // Empty line is skipped
        '',
      ].join('\n');
      writeFileSync(arbSegPath, seg);

      const features = await parseArtcc(arbBasePath, arbSegPath);

      const strata = features
        .filter((f) => f.identifier === 'ZNY')
        .map((f) => f.artccStratum)
        .sort();
      assert.deepEqual(strata, ['HIGH', 'LOW']);
      const low = features.find((f) => f.identifier === 'ZNY' && f.artccStratum === 'LOW');
      assert.ok(low !== undefined);
      assert.equal(low.type, 'ARTCC');
      assert.equal(low.name, 'NEW YORK');
      assert.equal(low.state, 'NY');
      assert.equal(low.controllingFacility, null);
      assert.equal(low.scheduleDescription, null);
      assert.equal(low.boundary.type, 'Polygon');
      assert.ok(low.boundary.coordinates[0]?.length ?? 0 >= 4);
      // No foreign center features
      assert.equal(
        features.find((f) => f.identifier === 'CZQM'),
        undefined,
      );
    } finally {
      cleanup();
    }
  });

  it('parses a UTA stratum from the UNLIMITED altitude class', async () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const arbBasePath = join(dir, 'ARB_BASE.csv');
      const arbSegPath = join(dir, 'ARB_SEG.csv');
      writeFileSync(
        arbBasePath,
        ['LOCATION_ID,LOCATION_NAME,COUNTRY_CODE,STATE', 'ZOA,OAKLAND,US,'].join('\n'),
      );
      writeFileSync(
        arbSegPath,
        [
          'LOCATION_ID,ALTITUDE,TYPE,POINT_SEQ,LAT_DECIMAL,LONG_DECIMAL,BNDRY_PT_DESCRIP',
          'ZOA,UNLIMITED,UTA,1,30.0,-130.0,A',
          'ZOA,UNLIMITED,UTA,2,30.0,-129.0,B',
          'ZOA,UNLIMITED,UTA,3,31.0,-129.0,C',
          'ZOA,UNLIMITED,UTA,4,31.0,-130.0,D',
          'ZOA,UNLIMITED,UTA,5,30.0,-130.0,POINT OF BEGINNING',
        ].join('\n'),
      );
      const features = await parseArtcc(arbBasePath, arbSegPath);
      const uta = features.find((f) => f.identifier === 'ZOA' && f.artccStratum === 'UTA');
      assert.ok(uta !== undefined);
      assert.equal(uta.state, null);
    } finally {
      cleanup();
    }
  });

  it('skips rows with non-finite numeric fields and unrecognized strata', async () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const arbBasePath = join(dir, 'ARB_BASE.csv');
      const arbSegPath = join(dir, 'ARB_SEG.csv');
      writeFileSync(
        arbBasePath,
        ['LOCATION_ID,LOCATION_NAME,COUNTRY_CODE,STATE', 'ZAB,ALBUQUERQUE,US,NM'].join('\n'),
      );
      writeFileSync(
        arbSegPath,
        [
          'LOCATION_ID,ALTITUDE,TYPE,POINT_SEQ,LAT_DECIMAL,LONG_DECIMAL,BNDRY_PT_DESCRIP',
          // Unknown stratum - skipped
          'ZAB,SUPER_HIGH,ARTCC,1,35.0,-106.0,A',
          // Bad lat - skipped
          'ZAB,LOW,ARTCC,1,abc,-106.0,A',
          // Valid square that closes via implicit closing rather than POINT OF BEGINNING
          'ZAB,LOW,ARTCC,1,35.0,-106.0,A',
          'ZAB,LOW,ARTCC,2,35.0,-105.0,B',
          'ZAB,LOW,ARTCC,3,36.0,-105.0,C',
          'ZAB,LOW,ARTCC,4,36.0,-106.0,D',
        ].join('\n'),
      );
      const features = await parseArtcc(arbBasePath, arbSegPath);
      assert.ok(features.find((f) => f.identifier === 'ZAB'));
    } finally {
      cleanup();
    }
  });

  it('throws when ARB_BASE.csv is missing required columns', async () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const arbBasePath = join(dir, 'ARB_BASE.csv');
      const arbSegPath = join(dir, 'ARB_SEG.csv');
      writeFileSync(arbBasePath, 'LOCATION_ID,LOCATION_NAME\nZNY,NEW YORK\n');
      writeFileSync(
        arbSegPath,
        'LOCATION_ID,ALTITUDE,TYPE,POINT_SEQ,LAT_DECIMAL,LONG_DECIMAL,BNDRY_PT_DESCRIP\n',
      );
      await assert.rejects(
        () => parseArtcc(arbBasePath, arbSegPath),
        /ARB_BASE.csv is missing expected columns/,
      );
    } finally {
      cleanup();
    }
  });

  it('throws when ARB_SEG.csv is missing required columns', async () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const arbBasePath = join(dir, 'ARB_BASE.csv');
      const arbSegPath = join(dir, 'ARB_SEG.csv');
      writeFileSync(
        arbBasePath,
        'LOCATION_ID,LOCATION_NAME,COUNTRY_CODE,STATE\nZNY,NEW YORK,US,NY\n',
      );
      writeFileSync(arbSegPath, 'LOCATION_ID,ALTITUDE,TYPE\nZNY,LOW,ARTCC\n');
      await assert.rejects(
        () => parseArtcc(arbBasePath, arbSegPath),
        /ARB_SEG.csv is missing expected columns/,
      );
    } finally {
      cleanup();
    }
  });

  it('skips rows where LOCATION_ID or LOCATION_NAME is empty', async () => {
    const { dir, cleanup } = makeTempDir();
    try {
      const arbBasePath = join(dir, 'ARB_BASE.csv');
      const arbSegPath = join(dir, 'ARB_SEG.csv');
      writeFileSync(
        arbBasePath,
        [
          'LOCATION_ID,LOCATION_NAME,COUNTRY_CODE,STATE',
          ',NO_ID,US,NY',
          'NONAME,,US,NY',
          'ZBW,BOSTON,US,MA',
        ].join('\n'),
      );
      writeFileSync(
        arbSegPath,
        [
          'LOCATION_ID,ALTITUDE,TYPE,POINT_SEQ,LAT_DECIMAL,LONG_DECIMAL,BNDRY_PT_DESCRIP',
          'ZBW,LOW,ARTCC,1,42.0,-71.0,A',
          'ZBW,LOW,ARTCC,2,42.0,-70.0,B',
          'ZBW,LOW,ARTCC,3,43.0,-70.0,C',
          'ZBW,LOW,ARTCC,4,43.0,-71.0,D',
          'ZBW,LOW,ARTCC,5,42.0,-71.0,POINT OF BEGINNING',
        ].join('\n'),
      );
      const features = await parseArtcc(arbBasePath, arbSegPath);
      assert.ok(features.find((f) => f.identifier === 'ZBW'));
    } finally {
      cleanup();
    }
  });

  it('warns and skips shapes with too few points', async () => {
    const { dir, cleanup } = makeTempDir();
    const originalWarn = console.warn;
    let warnCalled = false;
    console.warn = (): void => {
      warnCalled = true;
    };
    try {
      const arbBasePath = join(dir, 'ARB_BASE.csv');
      const arbSegPath = join(dir, 'ARB_SEG.csv');
      writeFileSync(
        arbBasePath,
        ['LOCATION_ID,LOCATION_NAME,COUNTRY_CODE,STATE', 'ZID,INDIANAPOLIS,US,IN'].join('\n'),
      );
      writeFileSync(
        arbSegPath,
        [
          'LOCATION_ID,ALTITUDE,TYPE,POINT_SEQ,LAT_DECIMAL,LONG_DECIMAL,BNDRY_PT_DESCRIP',
          // A degenerate shape with only 2 unique points
          'ZID,LOW,ARTCC,1,40.0,-86.0,A',
          'ZID,LOW,ARTCC,2,40.0,-85.0,POINT OF BEGINNING',
        ].join('\n'),
      );
      const features = await parseArtcc(arbBasePath, arbSegPath);
      assert.equal(features.length, 0);
      assert.equal(warnCalled, true);
    } finally {
      console.warn = originalWarn;
      cleanup();
    }
  });
});
