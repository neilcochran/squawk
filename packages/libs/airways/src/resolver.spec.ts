import { describe, it, beforeAll, expect, assert } from 'vitest';

import type { Airway } from '@squawk/types';

import { createAirwayResolver } from './resolver.js';
import type { AirwayResolver } from './resolver.js';

let resolver: AirwayResolver;

beforeAll(async () => {
  const { usBundledAirways } = await import('@squawk/airway-data');
  resolver = createAirwayResolver({ data: usBundledAirways.records });
});

describe('byDesignation', () => {
  it('returns matching Victor airways', () => {
    const results = resolver.byDesignation('V16');
    assert(results.length > 0, 'expected results for V16');
    for (const airway of results) {
      expect(airway.designation).toBe('V16');
      expect(airway.type).toBe('VICTOR');
      assert(airway.waypoints.length > 2);
    }
  });

  it('returns all regional variants of a shared designation', () => {
    const results = resolver.byDesignation('V16');
    assert(results.length >= 2, 'expected at least 2 V16 variants (US and Hawaii)');
    const regions = new Set(results.map((a) => a.region));
    assert(regions.has('US'), 'expected US variant');
    assert(regions.has('HAWAII'), 'expected Hawaii variant');
  });

  it('returns a matching Jet route', () => {
    const results = resolver.byDesignation('J60');
    assert(results.length > 0, 'expected results for J60');
    expect(results[0]!.type).toBe('JET');
  });

  it('is case-insensitive', () => {
    const results = resolver.byDesignation('v16');
    assert(results.length > 0, 'expected results for v16 (lowercase)');
    expect(results[0]!.designation).toBe('V16');
  });

  it('returns empty array for unknown designation', () => {
    expect(resolver.byDesignation('ZZZZZ')).toEqual([]);
  });
});

describe('expand', () => {
  it('returns an ordered waypoint sequence between two fixes', () => {
    const v16s = resolver.byDesignation('V16');
    assert(v16s.length > 0, 'expected V16 to exist');
    const v16 = v16s.find((a) => a.region === 'US')!;
    assert(v16.waypoints.length >= 3, 'V16 needs at least 3 waypoints to test expand');

    const firstWp = v16.waypoints[0]!;
    const lastWp = v16.waypoints[v16.waypoints.length - 1]!;

    if (firstWp.identifier && lastWp.identifier) {
      const result = resolver.expand('V16', firstWp.identifier, lastWp.identifier);
      assert(result, 'expected expand result');
      expect(result.waypoints[0]!.identifier).toBe(firstWp.identifier);
      expect(result.waypoints[result.waypoints.length - 1]!.identifier).toBe(lastWp.identifier);
      expect(result.waypoints.length).toBe(v16.waypoints.length);
    }
  });

  it('expands the correct regional variant based on fix names', () => {
    const v16s = resolver.byDesignation('V16');
    const usV16 = v16s.find((a) => a.region === 'US')!;
    const hiV16 = v16s.find((a) => a.region === 'HAWAII')!;
    assert(usV16, 'expected US V16');
    assert(hiV16, 'expected Hawaii V16');

    const usFirst = usV16.waypoints.find((wp) => wp.identifier)!;
    const usSecond = usV16.waypoints.filter((wp) => wp.identifier)[1]!;
    const usResult = resolver.expand('V16', usFirst.identifier!, usSecond.identifier!);
    assert(usResult, 'expected US expansion');
    expect(usResult.airway.region).toBe('US');

    const hiFirst = hiV16.waypoints.find((wp) => wp.identifier)!;
    const hiSecond = hiV16.waypoints.filter((wp) => wp.identifier)[1]!;
    const hiResult = resolver.expand('V16', hiFirst.identifier!, hiSecond.identifier!);
    assert(hiResult, 'expected Hawaii expansion');
    expect(hiResult.airway.region).toBe('HAWAII');
  });

  it('returns a subset when expanding between interior fixes', () => {
    const v16s = resolver.byDesignation('V16');
    const v16 = v16s.find((a) => a.region === 'US')!;

    const wpWithId = v16.waypoints.filter((wp) => wp.identifier);
    if (wpWithId.length >= 3) {
      const entry = wpWithId[1]!;
      const exit = wpWithId[wpWithId.length - 2]!;
      const result = resolver.expand('V16', entry.identifier!, exit.identifier!);
      assert(result, 'expected expand result for interior fixes');
      assert(result.waypoints.length < v16.waypoints.length);
      assert(result.waypoints.length >= 2);
    }
  });

  it('returns undefined for unknown airway', () => {
    expect(resolver.expand('ZZZZZ', 'A', 'B')).toBe(undefined);
  });

  it('supports reverse traversal when entry fix comes after exit fix in stored order', () => {
    const v16s = resolver.byDesignation('V16');
    const v16 = v16s.find((a) => a.region === 'US')!;

    const wpWithId = v16.waypoints.filter((wp) => wp.identifier);
    const firstId = wpWithId[0]!;
    const lastId = wpWithId[wpWithId.length - 1]!;

    // Expand in reverse: last -> first
    const result = resolver.expand('V16', lastId.identifier!, firstId.identifier!);
    assert(result, 'expected reverse expansion to succeed');
    // First waypoint in result should be the entry fix (last in stored order)
    expect(result.waypoints[0]!.identifier).toBe(lastId.identifier);
    // Last waypoint in result should be the exit fix (first in stored order)
    expect(result.waypoints[result.waypoints.length - 1]!.identifier).toBe(firstId.identifier);
    expect(result.waypoints.length).toBe(v16.waypoints.length);
  });

  it('returns undefined when fix is not on the airway', () => {
    expect(resolver.expand('V16', 'XYZZY', 'PLUGH')).toBe(undefined);
  });

  it('is case-insensitive for fix identifiers', () => {
    const v16s = resolver.byDesignation('V16');
    const v16 = v16s.find((a) => a.region === 'US')!;

    const first = v16.waypoints.find((wp) => wp.identifier);
    const last = [...v16.waypoints].reverse().find((wp) => wp.identifier);
    if (first && last && first.identifier !== last.identifier) {
      const result = resolver.expand(
        'v16',
        first.identifier!.toLowerCase(),
        last.identifier!.toUpperCase(),
      );
      assert(result, 'expected case-insensitive expand to work');
    }
  });

  describe('gaps', () => {
    const gapped: Airway = {
      designation: 'J999',
      type: 'JET',
      region: 'US',
      waypoints: [
        {
          name: 'ALPHA',
          identifier: 'ALPHA',
          waypointType: 'FIX',
          lat: 40,
          lon: -74,
          discontinued: true,
        },
        { name: 'BRAVO', identifier: 'BRAVO', waypointType: 'FIX', lat: 41, lon: -74 },
        {
          name: 'CHRLY',
          identifier: 'CHRLY',
          waypointType: 'FIX',
          lat: 42,
          lon: -74,
          discontinued: true,
        },
      ],
    };
    const gappedResolver = createAirwayResolver({ data: [gapped] });

    it('reports a published gap inside a forward expansion', () => {
      const result = gappedResolver.expand('J999', 'ALPHA', 'CHRLY');
      assert(result, 'expected expansion');
      expect(result.gaps).toEqual([{ index: 0, from: 'ALPHA', to: 'BRAVO' }]);
    });

    it('reports the gap in traversal order for a reverse expansion', () => {
      const result = gappedResolver.expand('J999', 'CHRLY', 'ALPHA');
      assert(result, 'expected expansion');
      expect(result.waypoints.map((wp) => wp.identifier)).toEqual(['CHRLY', 'BRAVO', 'ALPHA']);
      expect(result.gaps).toEqual([{ index: 1, from: 'BRAVO', to: 'ALPHA' }]);
    });

    it('ignores a gap flag on the final waypoint, whose gap lies beyond the expansion', () => {
      const result = gappedResolver.expand('J999', 'BRAVO', 'CHRLY');
      assert(result, 'expected expansion');
      expect(result.gaps).toEqual([]);
    });

    it('reports the J60 gap between JOT and DJB from the bundled data', () => {
      const forward = resolver.expand('J60', 'LAX', 'SAX');
      assert(forward, 'expected J60 to expand from LAX to SAX');
      expect(forward.gaps.map((gap) => `${gap.from}-${gap.to}`)).toEqual(['JOT-DJB']);
      expect(forward.waypoints[forward.gaps[0]!.index]?.identifier).toBe('JOT');

      const reverse = resolver.expand('J60', 'SAX', 'LAX');
      assert(reverse, 'expected J60 to expand from SAX to LAX');
      expect(reverse.gaps.map((gap) => `${gap.from}-${gap.to}`)).toEqual(['DJB-JOT']);
      expect(reverse.waypoints[reverse.gaps[0]!.index]?.identifier).toBe('DJB');
    });

    it('reports no gaps for a continuous expansion from the bundled data', () => {
      const result = resolver.expand('J60', 'LAX', 'HEC');
      assert(result, 'expected J60 to expand from LAX to HEC');
      expect(result.gaps).toEqual([]);
    });
  });
});

describe('expand unusable segments', () => {
  const flagged: Airway = {
    designation: 'V999',
    type: 'VICTOR',
    region: 'US',
    waypoints: [
      { name: 'ALPHA', identifier: 'ALPHA', waypointType: 'FIX', lat: 40, lon: -74 },
      {
        name: 'BRAVO',
        identifier: 'BRAVO',
        waypointType: 'FIX',
        lat: 41,
        lon: -74,
        unusable: true,
        remarks: ['UNUSABLE'],
      },
      { name: 'CHRLY', identifier: 'CHRLY', waypointType: 'FIX', lat: 42, lon: -74 },
      {
        name: 'DELTA',
        identifier: 'DELTA',
        waypointType: 'FIX',
        lat: 43,
        lon: -74,
        unusable: true,
      },
    ],
  };
  const flaggedResolver = createAirwayResolver({ data: [flagged] });

  it('reports the unusable segment inside a forward expansion and no gap', () => {
    const result = flaggedResolver.expand('V999', 'ALPHA', 'CHRLY');
    assert(result);
    expect(result.unusable).toEqual([{ index: 1, from: 'BRAVO', to: 'CHRLY' }]);
    expect(result.gaps).toEqual([]);
  });

  it('reports the unusable segment in traversal order for a reverse expansion', () => {
    const result = flaggedResolver.expand('V999', 'CHRLY', 'ALPHA');
    assert(result);
    expect(result.unusable).toEqual([{ index: 0, from: 'CHRLY', to: 'BRAVO' }]);
  });

  it('ignores an unusable flag on the final waypoint, whose segment lies beyond the expansion', () => {
    const result = flaggedResolver.expand('V999', 'CHRLY', 'DELTA');
    assert(result);
    expect(result.unusable).toEqual([]);
  });

  it('reports the J34 unusable segment between DRYER and GAABE from the bundled data', () => {
    const forward = resolver.expand('J34', 'DJB', 'GAABE');
    assert(forward);
    expect(forward.unusable.map((segment) => `${segment.from}-${segment.to}`)).toEqual([
      'DJB-GAABE',
    ]);
    expect(forward.gaps).toEqual([]);
    const reverse = resolver.expand('J34', 'GAABE', 'DJB');
    assert(reverse);
    expect(reverse.unusable.map((segment) => `${segment.from}-${segment.to}`)).toEqual([
      'GAABE-DJB',
    ]);
  });

  it('reports a segment the FAA marks unusable only by remark from the bundled data', () => {
    const result = resolver.expand('V70', 'LUMPP', 'AMAPO');
    assert(result);
    expect(result.unusable).toEqual([{ index: 0, from: 'LUMPP', to: 'AMAPO' }]);
  });

  it('reports no unusable segments for an ordinary expansion from the bundled data', () => {
    const result = resolver.expand('J60', 'LAX', 'HEC');
    assert(result);
    expect(result.unusable).toEqual([]);
  });
});

describe('byFix', () => {
  it('returns airways that pass through a known fix/navaid', () => {
    const v16s = resolver.byDesignation('V16');
    assert(v16s.length > 0);
    const v16 = v16s[0]!;

    const wpWithId = v16.waypoints.find((wp) => wp.identifier);
    if (wpWithId) {
      const results = resolver.byFix(wpWithId.identifier!);
      assert(results.length > 0, 'expected at least one airway through this fix');

      const hasV16 = results.some((r) => r.airway.designation === 'V16');
      assert(hasV16, 'expected V16 in byFix results');
    }
  });

  it('is case-insensitive', () => {
    const v16s = resolver.byDesignation('V16');
    assert(v16s.length > 0);
    const v16 = v16s[0]!;

    const wpWithId = v16.waypoints.find((wp) => wp.identifier);
    if (wpWithId) {
      const upper = resolver.byFix(wpWithId.identifier!.toUpperCase());
      const lower = resolver.byFix(wpWithId.identifier!.toLowerCase());
      expect(upper.length).toBe(lower.length);
    }
  });

  it('returns empty array for unknown fix', () => {
    expect(resolver.byFix('XYZZY')).toEqual([]);
  });

  it('includes the waypointIndex in results', () => {
    const v16s = resolver.byDesignation('V16');
    assert(v16s.length > 0);
    const v16 = v16s[0]!;

    const wpWithId = v16.waypoints.find((wp) => wp.identifier);
    if (wpWithId) {
      const results = resolver.byFix(wpWithId.identifier!);
      for (const result of results) {
        expect(typeof result.waypointIndex).toBe('number');
        assert(result.waypointIndex >= 0);
        assert(result.waypointIndex < result.airway.waypoints.length);
      }
    }
  });
});

describe('search', () => {
  it('ranks an exact designation match first with field and ranges', () => {
    const results = resolver.search({ text: 'V16' });
    assert(results.length > 0, 'expected results for V16');
    expect(results[0]!.airway.designation).toBe('V16');
    expect(results[0]!.matchedField).toBe('designation');
    expect(results[0]!.score).toBe(1);
    expect(results[0]!.ranges).toEqual([{ start: 0, end: 3 }]);
  });

  it('returns results sorted by descending score', () => {
    const results = resolver.search({ text: 'J' });
    for (let i = 1; i < results.length; i++) {
      assert(
        results[i]!.score <= results[i - 1]!.score,
        'results should be sorted by descending score',
      );
    }
  });

  it('respects the limit parameter', () => {
    const results = resolver.search({ text: 'V', limit: 5 });
    assert(results.length <= 5);
  });

  it('filters by airway type when provided', () => {
    const empty = resolver.search({
      text: '',
      types: new Set(['JET'] as const),
    });
    expect(empty.length, 'empty text should return empty results').toBe(0);

    const jetResults = resolver.search({
      text: 'J',
      types: new Set(['JET'] as const),
    });
    for (const r of jetResults) {
      expect(r.airway.type).toBe('JET');
    }
  });

  it('is case-insensitive', () => {
    const upper = resolver.search({ text: 'V16' });
    const lower = resolver.search({ text: 'v16' });
    expect(upper.length).toBe(lower.length);
  });

  it('keeps only matches above the minScore threshold', () => {
    const lenient = resolver.search({ text: 'V16' });
    const strict = resolver.search({ text: 'V16', minScore: 0.5 });
    assert(strict.length <= lenient.length, 'raising minScore should not add results');
    for (const r of strict) {
      assert(r.score > 0.5, `expected score > 0.5, got ${r.score}`);
    }
  });

  it('returns empty array for empty text', () => {
    expect(resolver.search({ text: '' })).toEqual([]);
  });
});
