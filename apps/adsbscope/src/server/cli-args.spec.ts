import { describe, expect, it } from 'vitest';

import { DEFAULT_PORT_BY_SOURCE } from '@squawk/adsb-feed';

import { DEFAULT_LISTEN_PORT } from '../shared/protocol.js';

import {
  DEFAULT_BIND_ADDRESS,
  DEFAULT_RANGE_NM,
  DEFAULT_STALE_AFTER_MS,
  parseCliArgs,
} from './cli-args.js';
import type { CliArgsError, CliOptions } from './cli-args.js';

const LOCATION = ['--lat', '40.6413', '--lon', '-73.7781'];

function isError(result: CliOptions | CliArgsError): result is CliArgsError {
  return 'message' in result;
}

function parseOk(argv: string[]): CliOptions {
  const result = parseCliArgs(argv);
  if (isError(result)) {
    throw new Error(`expected options, got error: ${result.message}`);
  }
  return result;
}

function parseError(argv: string[]): string {
  const result = parseCliArgs(argv);
  if (!isError(result)) {
    throw new Error('expected an error');
  }
  return result.message;
}

describe('parseCliArgs', () => {
  it('applies every default when only the location is given', () => {
    expect(parseOk(LOCATION)).toEqual({
      help: false,
      source: 'beast',
      host: 'localhost',
      port: DEFAULT_PORT_BY_SOURCE.beast,
      url: undefined,
      location: { lat: 40.6413, lon: -73.7781 },
      mode: 'digital',
      rangeNm: DEFAULT_RANGE_NM,
      listenPort: DEFAULT_LISTEN_PORT,
      bindAddress: DEFAULT_BIND_ADDRESS,
      replayPath: undefined,
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
      registry: true,
    });
  });

  it('sets help true and skips validation for --help and -h', () => {
    expect(parseOk(['--help']).help).toBe(true);
    expect(parseOk(['-h']).help).toBe(true);
  });

  it('reports an unknown flag', () => {
    expect(parseError([...LOCATION, '--nope'])).toContain('--nope');
  });

  describe('location', () => {
    it('requires both --lat and --lon', () => {
      expect(parseError([])).toContain('--lat and --lon are required');
      expect(parseError(['--lat', '40'])).toContain('--lat and --lon are required');
      expect(parseError(['--lon', '-73'])).toContain('--lat and --lon are required');
    });

    it('accepts a negative value in both the spaced and = forms', () => {
      expect(parseOk(['--lat', '-33.9', '--lon', '-70.7']).location).toEqual({
        lat: -33.9,
        lon: -70.7,
      });
      expect(parseOk(['--lat=-33.9', '--lon=-70.7']).location).toEqual({ lat: -33.9, lon: -70.7 });
    });

    it('rejects an out-of-range or non-numeric latitude', () => {
      expect(parseError(['--lat', '91', '--lon', '0'])).toContain('Invalid --lat "91"');
      expect(parseError(['--lat', 'north', '--lon', '0'])).toContain('Invalid --lat "north"');
    });

    it('rejects an out-of-range or non-numeric longitude', () => {
      expect(parseError(['--lat', '0', '--lon', '181'])).toContain('Invalid --lon "181"');
      expect(parseError(['--lat', '0', '--lon', 'west'])).toContain('Invalid --lon "west"');
    });
  });

  describe('station connection', () => {
    it('parses an explicit --source, --host, and --port', () => {
      const result = parseOk([
        ...LOCATION,
        '--source',
        'sbs',
        '--host',
        '192.168.1.50',
        '--port',
        '31003',
      ]);
      expect(result.source).toBe('sbs');
      expect(result.host).toBe('192.168.1.50');
      expect(result.port).toBe(31003);
    });

    it('defaults the port per source', () => {
      expect(parseOk([...LOCATION, '--source', 'json']).port).toBe(DEFAULT_PORT_BY_SOURCE.json);
      expect(parseOk([...LOCATION, '--source', 'sbs']).port).toBe(DEFAULT_PORT_BY_SOURCE.sbs);
    });

    it('rejects an unknown source', () => {
      expect(parseError([...LOCATION, '--source', 'radar'])).toContain('Invalid --source "radar"');
    });

    it('rejects an invalid --port', () => {
      expect(parseError([...LOCATION, '--port', '0'])).toContain('Invalid --port "0"');
      expect(parseError([...LOCATION, '--port', '70000'])).toContain('Invalid --port "70000"');
      expect(parseError([...LOCATION, '--port', '80.5'])).toContain('Invalid --port "80.5"');
    });

    it('accepts --url for the json source only', () => {
      const url = 'http://example.com/aircraft.json';
      expect(parseOk([...LOCATION, '--source', 'json', '--url', url]).url).toBe(url);
      expect(parseError([...LOCATION, '--url', url])).toBe(
        '--url is only valid with --source json.',
      );
    });

    it('parses --stale-after and rejects a non-positive or fractional value', () => {
      expect(parseOk([...LOCATION, '--stale-after', '15000']).staleAfterMs).toBe(15_000);
      expect(parseError([...LOCATION, '--stale-after', '0'])).toContain('Invalid --stale-after');
      expect(parseError([...LOCATION, '--stale-after', '1.5'])).toContain('Invalid --stale-after');
    });

    it('turns the aircraft registry off with --no-registry', () => {
      expect(parseOk(LOCATION).registry).toBe(true);
      expect(parseOk([...LOCATION, '--no-registry']).registry).toBe(false);
    });
  });

  describe('replay', () => {
    it('parses --replay', () => {
      expect(parseOk([...LOCATION, '--replay', 'session.jsonl']).replayPath).toBe('session.jsonl');
    });

    it('rejects a blank --replay path', () => {
      expect(parseError([...LOCATION, '--replay', ' '])).toBe('--replay needs a file path.');
    });
  });

  describe('scope and server', () => {
    it('parses --mode and rejects an unknown one', () => {
      expect(parseOk([...LOCATION, '--mode', 'analog']).mode).toBe('analog');
      expect(parseError([...LOCATION, '--mode', 'retro'])).toBe(
        'Invalid --mode "retro" - expected digital or analog.',
      );
    });

    it('parses --range and rejects a non-positive, oversized, or non-numeric one', () => {
      expect(parseOk([...LOCATION, '--range', '25']).rangeNm).toBe(25);
      expect(parseError([...LOCATION, '--range', '0'])).toContain('Invalid --range "0"');
      expect(parseError([...LOCATION, '--range', '501'])).toContain('Invalid --range "501"');
      expect(parseError([...LOCATION, '--range', 'far'])).toContain('Invalid --range "far"');
    });

    it('parses --listen-port and rejects an invalid one', () => {
      expect(parseOk([...LOCATION, '--listen-port', '9000']).listenPort).toBe(9000);
      expect(parseError([...LOCATION, '--listen-port', '-1'])).toContain('--listen-port');
      expect(parseError([...LOCATION, '--listen-port', '99999'])).toContain(
        'Invalid --listen-port "99999"',
      );
    });

    it('parses --bind and rejects a blank one', () => {
      expect(parseOk([...LOCATION, '--bind', '0.0.0.0']).bindAddress).toBe('0.0.0.0');
      expect(parseError([...LOCATION, '--bind', ' '])).toBe('--bind needs an address.');
    });
  });
});
