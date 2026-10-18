import { describe, it, expect } from 'vitest';

import {
  describeLegStatus,
  formatDistanceNm,
  formatEteHrs,
  formatLegStatus,
  formatRouteIssue,
} from './plan-format.ts';

describe('formatDistanceNm', () => {
  it('rounds to the nearest whole mile with a unit suffix', () => {
    expect(formatDistanceNm(123.4)).toBe('123 nm');
    expect(formatDistanceNm(123.6)).toBe('124 nm');
  });

  it('groups thousands', () => {
    expect(formatDistanceNm(1234.6)).toBe('1,235 nm');
  });

  it('formats zero', () => {
    expect(formatDistanceNm(0)).toBe('0 nm');
  });
});

describe('formatEteHrs', () => {
  it('formats hours and minutes as H:MM', () => {
    expect(formatEteHrs(1.5)).toBe('1:30');
  });

  it('zero-pads single-digit minutes', () => {
    expect(formatEteHrs(2.05)).toBe('2:03');
  });

  it('formats a sub-hour time', () => {
    expect(formatEteHrs(0.75)).toBe('0:45');
  });

  it('rolls a full 60 minutes up into the hour', () => {
    expect(formatEteHrs(0.999)).toBe('1:00');
  });
});

describe('formatRouteIssue', () => {
  it('names a STAR and the arrival airport it does not serve', () => {
    expect(
      formatRouteIssue({
        kind: 'airportMismatch',
        procedure: 'AALLE4',
        procedureType: 'STAR',
        airport: 'KBOS',
      }),
    ).toBe('STAR AALLE4 does not serve the arrival airport KBOS');
  });

  it('names a SID and the departure airport it does not serve', () => {
    expect(
      formatRouteIssue({
        kind: 'airportMismatch',
        procedure: 'DEEZZ6',
        procedureType: 'SID',
        airport: 'KBOS',
      }),
    ).toBe('SID DEEZZ6 does not serve the departure airport KBOS');
  });

  it('names the airway and the waypoints either side of a gap', () => {
    expect(formatRouteIssue({ kind: 'gap', airway: 'J60', from: 'JOT', to: 'DJB' })).toBe(
      'J60 is not defined between JOT and DJB',
    );
  });

  it('names the airway and the ends of an unusable segment', () => {
    expect(formatRouteIssue({ kind: 'unusable', airway: 'J108', from: 'TCS', to: 'GINGR' })).toBe(
      'J108 from TCS to GINGR is unusable',
    );
  });
});

describe('formatLegStatus', () => {
  it('tags each kind of invalid leg', () => {
    expect(formatLegStatus('gap')).toBe('gap');
    expect(formatLegStatus('unusable')).toBe('unusable');
    expect(formatLegStatus('airportMismatch')).toBe('wrong airport');
  });
});

describe('describeLegStatus', () => {
  it('explains each kind of invalid leg', () => {
    expect(describeLegStatus('gap')).toBe(
      'The airway is not defined between these points: it crosses a published gap.',
    );
    expect(describeLegStatus('unusable')).toBe('The FAA marks this airway segment unusable.');
    expect(describeLegStatus('airportMismatch')).toBe(
      'This SID or STAR does not serve the airport it is filed at.',
    );
  });
});
