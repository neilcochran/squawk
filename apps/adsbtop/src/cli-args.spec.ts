import { describe, expect, it } from 'vitest';

import { DEFAULT_PORT_BY_SOURCE, parseCliArgs } from './cli-args.js';
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
