import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { MultiPolygon, Polygon } from 'geojson';
import { describe, it, expect, assert, vi, afterEach } from 'vitest';

import { dbfString, extractPolygons, parseClassAirspace } from './parse-class-airspace.js';
import { clockwiseSquare, writeClassAirspaceShapefile } from './test-utils.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dbfString', () => {
  it('returns trimmed text for a real value', () => {
    expect(dbfString('RDR ')).toBe('RDR');
  });

  it('treats null, blank and the <Null> placeholder as absent', () => {
    expect(dbfString(null)).toBe(null);
    expect(dbfString(undefined)).toBe(null);
    expect(dbfString('')).toBe(null);
    expect(dbfString('   ')).toBe(null);
    expect(dbfString('<Null>')).toBe(null);
  });
});

describe('extractPolygons', () => {
  const square = (offset: number): number[][] => [
    [offset, 0],
    [offset + 1, 0],
    [offset + 1, 1],
    [offset, 1],
    [offset, 0],
  ];

  it('returns a Polygon as is', () => {
    const polygon: Polygon = { type: 'Polygon', coordinates: [square(0)] };
    expect(extractPolygons(polygon, 'TEST')).toEqual([polygon]);
  });

  it('returns one Polygon per MultiPolygon part, keeping every part', () => {
    // The Florida Class E5 area is a peninsula part plus the detached Key
    // West part; both must survive, however small the second one is.
    const multi: MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [[square(0)], [square(10)]],
    };
    const parts = extractPolygons(multi, 'FLORIDA CLASS E5');
    expect(parts.length).toBe(2);
    expect(parts[0]).toEqual({ type: 'Polygon', coordinates: [square(0)] });
    expect(parts[1]).toEqual({ type: 'Polygon', coordinates: [square(10)] });
  });

  it('keeps holes with their part', () => {
    const hole: number[][] = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.75, 0.75],
      [0.25, 0.75],
      [0.25, 0.25],
    ];
    const multi: MultiPolygon = { type: 'MultiPolygon', coordinates: [[square(0), hole]] };
    expect(extractPolygons(multi, 'TEST')[0]?.coordinates).toEqual([square(0), hole]);
  });
});

describe('extractPolygons with an unexpected geometry', () => {
  it('warns and returns no polygons', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const point = { type: 'Point', coordinates: [0, 0] } as unknown as Polygon;
    expect(extractPolygons(point, 'ODD')).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected geometry type for "ODD"'),
    );
  });
});

describe('parseClassAirspace', () => {
  /**
   * Writes the given records to a shapefile in a fresh temporary directory,
   * parses it, and removes the directory.
   */
  async function parseRecords(
    records: Parameters<typeof writeClassAirspaceShapefile>[1],
    airportStates = new Map<string, string>(),
  ): ReturnType<typeof parseClassAirspace> {
    const dir = mkdtempSync(join(tmpdir(), 'parse-class-airspace-'));
    try {
      return await parseClassAirspace(writeClassAirspaceShapefile(dir, records), airportStates);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('builds a feature from each included record, with its altitudes, state and remarks', async () => {
    const features = await parseRecords(
      [
        {
          rings: [clockwiseSquare(-71.1, 42.3)],
          attributes: {
            IDENT: 'BED',
            NAME: 'BEDFORD CLASS D',
            LOCAL_TYPE: 'CLASS_D',
            UPPER_VAL: '2600',
            UPPER_UOM: 'FT',
            UPPER_CODE: 'MSL',
            LOWER_VAL: '0',
            LOWER_UOM: 'FT',
            LOWER_CODE: 'SFC',
            COMM_NAME: '<Null>',
            WKHR_RMK: '0700-2300 LOCAL',
          },
        },
      ],
      new Map([['BED', 'MA']]),
    );

    expect(features.length).toBe(1);
    const [feature] = features;
    assert(feature !== undefined);
    expect(feature.type).toBe('CLASS_D');
    expect(feature.name).toBe('BEDFORD CLASS D');
    expect(feature.identifier).toBe('BED');
    expect(feature.state).toBe('MA');
    expect(feature.floor).toEqual({ valueFt: 0, reference: 'SFC' });
    expect(feature.ceiling).toEqual({ valueFt: 2600, reference: 'MSL' });
    expect(feature.controllingFacility).toBe(null);
    expect(feature.scheduleDescription).toBe('0700-2300 LOCAL');
    expect(feature.artccStratum).toBe(null);
    expect(feature.boundary.type).toBe('Polygon');
  });

  it('skips records whose type is not a Class B, C, D or E area', async () => {
    const features = await parseRecords([
      {
        rings: [clockwiseSquare(-71, 42)],
        attributes: { IDENT: 'XYZ', NAME: 'MODE C AREA', LOCAL_TYPE: 'MODE C' },
      },
      {
        rings: [clockwiseSquare(-72, 42)],
        attributes: { IDENT: 'ABC', NAME: 'NO TYPE' },
      },
    ]);
    expect(features).toEqual([]);
  });

  it('emits one feature per part of a multi-part record, all with its attributes', async () => {
    const features = await parseRecords([
      {
        rings: [clockwiseSquare(-81, 25), clockwiseSquare(-83, 24)],
        attributes: {
          NAME: '',
          LOCAL_TYPE: 'CLASS_E5',
          UPPER_VAL: '-9998',
          UPPER_UOM: 'FT',
          UPPER_CODE: 'MSL',
          LOWER_VAL: '700',
          LOWER_UOM: 'FT',
          LOWER_CODE: 'AGL',
        },
      },
    ]);

    expect(features.length).toBe(2);
    for (const feature of features) {
      expect(feature.type).toBe('CLASS_E5');
      expect(feature.name).toBe('');
      expect(feature.identifier).toBe('');
      expect(feature.state).toBe(null);
      expect(feature.floor).toEqual({ valueFt: 700, reference: 'AGL' });
    }
  });

  it('leaves the state unset for an airport the lookup does not know', async () => {
    const features = await parseRecords([
      {
        rings: [clockwiseSquare(-120, 40)],
        attributes: { IDENT: 'ZZZ', NAME: 'NOWHERE CLASS E2', LOCAL_TYPE: 'CLASS_E2' },
      },
    ]);
    expect(features[0]?.identifier).toBe('ZZZ');
    expect(features[0]?.state).toBe(null);
  });
});
