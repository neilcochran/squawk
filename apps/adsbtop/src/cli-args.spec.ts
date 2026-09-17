import { describe, expect, it } from 'vitest';

import { DEFAULT_PORT_BY_SOURCE, DEFAULT_STALE_AFTER_MS, parseCliArgs } from './cli-args.js';
import type { CliArgsError, CliOptions } from './cli-args.js';

function isError(result: CliOptions | CliArgsError): result is CliArgsError {
  return 'message' in result;
}

describe('parseCliArgs', () => {
  it('defaults to the sbs source on localhost with no arguments', () => {
    const result = parseCliArgs([]);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.help).toBe(false);
      expect(result.source).toBe('sbs');
      expect(result.host).toBe('localhost');
      expect(result.port).toBe(DEFAULT_PORT_BY_SOURCE.sbs);
      expect(result.url).toBeUndefined();
    }
  });

  it('sets help true and skips validation when --help is passed', () => {
    const result = parseCliArgs(['--help']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.help).toBe(true);
    }
  });

  it('accepts the -h short flag for help', () => {
    const result = parseCliArgs(['-h']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.help).toBe(true);
    }
  });

  it('parses an explicit --source, --host, and --port', () => {
    const result = parseCliArgs(['--source', 'beast', '--host', '192.168.1.50', '--port', '30005']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.source).toBe('beast');
      expect(result.host).toBe('192.168.1.50');
      expect(result.port).toBe(30005);
    }
  });

  it('defaults the port per source when --port is omitted', () => {
    const json = parseCliArgs(['--source', 'json']);
    const sbs = parseCliArgs(['--source', 'sbs']);
    const beast = parseCliArgs(['--source', 'beast']);
    expect(!isError(json) && json.port).toBe(DEFAULT_PORT_BY_SOURCE.json);
    expect(!isError(sbs) && sbs.port).toBe(DEFAULT_PORT_BY_SOURCE.sbs);
    expect(!isError(beast) && beast.port).toBe(DEFAULT_PORT_BY_SOURCE.beast);
  });

  it('parses --url for the json source', () => {
    const result = parseCliArgs([
      '--source',
      'json',
      '--url',
      'http://192.168.1.50:8080/data/aircraft.json',
    ]);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.url).toBe('http://192.168.1.50:8080/data/aircraft.json');
    }
  });

  it('rejects an unrecognized --source value', () => {
    const result = parseCliArgs(['--source', 'radar']);
    expect(isError(result)).toBe(true);
  });

  it('rejects --url when the source is not json', () => {
    const result = parseCliArgs(['--source', 'sbs', '--url', 'http://example.com']);
    expect(isError(result)).toBe(true);
  });

  it('rejects a non-numeric --port', () => {
    const result = parseCliArgs(['--port', 'abc']);
    expect(isError(result)).toBe(true);
  });

  it('rejects a --port outside the valid TCP range', () => {
    const result = parseCliArgs(['--port', '70000']);
    expect(isError(result)).toBe(true);
  });

  it('rejects an unrecognized flag', () => {
    const result = parseCliArgs(['--bogus']);
    expect(isError(result)).toBe(true);
  });

  it('defaults location to undefined with no --lat/--lon', () => {
    const result = parseCliArgs([]);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.location).toBeUndefined();
    }
  });

  it('defaults columnKeys to undefined (auto-fit) with no --columns', () => {
    const result = parseCliArgs([]);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.columnKeys).toBeUndefined();
    }
  });

  it('parses --columns header names into column keys', () => {
    const result = parseCliArgs(['--columns', 'icao,Callsign,ALT']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.columnKeys).toEqual(['icaoHex', 'callsign', 'altitude']);
    }
  });

  it('accepts the location columns in --columns when --lat/--lon are given', () => {
    const result = parseCliArgs([
      '--columns',
      'icao,dist,cpa',
      '--lat',
      '43.67',
      '--lon',
      '-70.36',
    ]);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.columnKeys).toEqual(['icaoHex', 'distance', 'closestApproach']);
    }
  });

  it('rejects a location column in --columns without --lat/--lon', () => {
    const result = parseCliArgs(['--columns', 'icao,brg']);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('Brg');
      expect(result.message).toContain('--lat/--lon');
    }
  });

  it('rejects a column in --columns that the chosen source never sends', () => {
    const result = parseCliArgs(['--columns', 'icao,cat']);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toBe('--columns includes Cat, which is not sent by sbs.');
    }
  });

  it('accepts a source-gated column in --columns with a source that sends it', () => {
    const result = parseCliArgs(['--columns', 'icao,cat', '--source', 'json']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.columnKeys).toEqual(['icaoHex', 'category']);
    }
  });

  it('rejects an unknown column name in --columns', () => {
    const result = parseCliArgs(['--columns', 'icao,bogus']);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('Unknown column "bogus"');
    }
  });

  it('defaults filter to undefined with no --filter', () => {
    const result = parseCliArgs([]);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.filter).toBeUndefined();
    }
  });

  it('parses --filter with the prompt syntax, including the -f short form', () => {
    for (const argv of [
      ['--filter', 'is:air UAL'],
      ['-f', 'is:air UAL'],
    ]) {
      const result = parseCliArgs(argv);
      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.filter?.text).toBe('is:air UAL');
        expect(result.filter?.onGround).toBe(false);
        expect(result.filter?.terms).toEqual(['UAL']);
      }
    }
  });

  it('accepts within: in --filter when --lat/--lon are given', () => {
    const result = parseCliArgs(['-f', 'within:25', '--lat', '43.67', '--lon', '-70.36']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.filter?.withinNm).toBe(25);
    }
  });

  it('rejects within: in --filter without --lat/--lon', () => {
    const result = parseCliArgs(['-f', 'within:25']);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('Invalid --filter');
      expect(result.message).toContain('--lat/--lon');
    }
  });

  it('rejects an invalid --filter term with the prompt message', () => {
    const result = parseCliArgs(['--filter', 'is:flying']);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('Invalid --filter');
      expect(result.message).toContain('Unknown state "flying"');
    }
  });

  it('rejects an empty --filter', () => {
    const result = parseCliArgs(['--filter', '  ']);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('at least one term');
    }
  });

  it('defaults --stale-after to the feed default', () => {
    const result = parseCliArgs([]);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.staleAfterMs).toBe(DEFAULT_STALE_AFTER_MS);
    }
  });

  it('parses --stale-after as milliseconds', () => {
    const result = parseCliArgs(['--stale-after', '30000']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.staleAfterMs).toBe(30_000);
    }
  });

  it('rejects a --stale-after that is not a positive whole number', () => {
    for (const argv of [
      ['--stale-after', 'abc'],
      ['--stale-after', '0'],
      ['--stale-after=-5'],
      ['--stale-after', '1.5'],
    ]) {
      const result = parseCliArgs(argv);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.message).toContain('Invalid --stale-after');
      }
    }
  });

  it('defaults to no watchlist, no emergency alerts, and the bell enabled', () => {
    const result = parseCliArgs([]);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.watchlist).toEqual([]);
      expect(result.alertEmergency).toBe(false);
      expect(result.bell).toBe(true);
    }
  });

  it('parses --watch into normalized terms', () => {
    const result = parseCliArgs(['--watch', 'a0b1c2, n12345,UAL']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.watchlist).toEqual(['A0B1C2', 'N12345', 'UAL']);
    }
  });

  it('rejects an empty --watch', () => {
    const result = parseCliArgs(['--watch', ' , ']);
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain('--watch needs at least one');
    }
  });

  it('parses --alert-emergency and --no-bell', () => {
    const result = parseCliArgs(['--alert-emergency', '--no-bell']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.alertEmergency).toBe(true);
      expect(result.bell).toBe(false);
    }
  });

  it('parses valid --lat and --lon into location', () => {
    const result = parseCliArgs(['--lat', '40.6413', '--lon', '-73.7781']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.location).toEqual({ lat: 40.6413, lon: -73.7781 });
    }
  });

  it('parses a negative --lat given as a separate argument, not just --lat=-N', () => {
    const result = parseCliArgs(['--lat', '-33.9425', '--lon', '-118.4081']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.location).toEqual({ lat: -33.9425, lon: -118.4081 });
    }
  });

  it('still accepts the explicit --lon=-N form', () => {
    const result = parseCliArgs(['--lat', '40.6413', '--lon=-73.7781']);
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.location).toEqual({ lat: 40.6413, lon: -73.7781 });
    }
  });

  it('rejects --lat without --lon', () => {
    const result = parseCliArgs(['--lat', '40.6413']);
    expect(isError(result)).toBe(true);
  });

  it('rejects --lon without --lat', () => {
    const result = parseCliArgs(['--lon', '-73.7781']);
    expect(isError(result)).toBe(true);
  });

  it('rejects a non-numeric --lat', () => {
    const result = parseCliArgs(['--lat', 'abc', '--lon', '0']);
    expect(isError(result)).toBe(true);
  });

  it('rejects a non-numeric --lon', () => {
    const result = parseCliArgs(['--lat', '0', '--lon', 'abc']);
    expect(isError(result)).toBe(true);
  });

  it('rejects a --lat outside -90..90', () => {
    const result = parseCliArgs(['--lat', '91', '--lon', '0']);
    expect(isError(result)).toBe(true);
  });

  it('rejects a --lon outside -180..180', () => {
    const result = parseCliArgs(['--lat', '0', '--lon', '181']);
    expect(isError(result)).toBe(true);
  });
});
