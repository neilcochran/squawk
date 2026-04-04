import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createAirwayResolver } from './resolver.js';
import type { AirwayResolver } from './resolver.js';

let resolver: AirwayResolver;

before(async () => {
  const { usBundledAirways } = await import('@squawk/airway-data');
  resolver = createAirwayResolver({ data: usBundledAirways.records });
});

describe('byDesignation', () => {
  it('returns a matching Victor airway', () => {
    const result = resolver.byDesignation('V16');
    assert.ok(result, 'expected a result for V16');
    assert.equal(result.designation, 'V16');
    assert.equal(result.type, 'VICTOR');
    assert.ok(result.waypoints.length > 2);
  });

  it('returns a matching Jet route', () => {
    const result = resolver.byDesignation('J60');
    assert.ok(result, 'expected a result for J60');
    assert.equal(result.type, 'JET');
  });

  it('is case-insensitive', () => {
    const result = resolver.byDesignation('v16');
    assert.ok(result, 'expected a result for v16 (lowercase)');
    assert.equal(result.designation, 'V16');
  });

  it('returns undefined for unknown designation', () => {
    assert.equal(resolver.byDesignation('ZZZZZ'), undefined);
  });
});

describe('expand', () => {
  it('returns an ordered waypoint sequence between two fixes', () => {
    const v16 = resolver.byDesignation('V16');
    assert.ok(v16, 'expected V16 to exist');
    assert.ok(v16.waypoints.length >= 3, 'V16 needs at least 3 waypoints to test expand');

    const firstWp = v16.waypoints[0]!;
    const lastWp = v16.waypoints[v16.waypoints.length - 1]!;

    if (firstWp.identifier && lastWp.identifier) {
      const result = resolver.expand('V16', firstWp.identifier, lastWp.identifier);
      assert.ok(result, 'expected expand result');
      assert.equal(result.waypoints[0]!.identifier, firstWp.identifier);
      assert.equal(result.waypoints[result.waypoints.length - 1]!.identifier, lastWp.identifier);
      assert.equal(result.waypoints.length, v16.waypoints.length);
    }
  });

  it('returns a subset when expanding between interior fixes', () => {
    const v16 = resolver.byDesignation('V16');
    assert.ok(v16);

    const wpWithId = v16.waypoints.filter((wp) => wp.identifier);
    if (wpWithId.length >= 3) {
      const entry = wpWithId[1]!;
      const exit = wpWithId[wpWithId.length - 2]!;
      const result = resolver.expand('V16', entry.identifier!, exit.identifier!);
      assert.ok(result, 'expected expand result for interior fixes');
      assert.ok(result.waypoints.length < v16.waypoints.length);
      assert.ok(result.waypoints.length >= 2);
    }
  });

  it('returns undefined for unknown airway', () => {
    assert.equal(resolver.expand('ZZZZZ', 'A', 'B'), undefined);
  });

  it('returns undefined when entry fix comes after exit fix', () => {
    const v16 = resolver.byDesignation('V16');
    assert.ok(v16);

    const firstId = v16.waypoints.find((wp) => wp.identifier);
    const lastId = [...v16.waypoints].reverse().find((wp) => wp.identifier);

    if (firstId && lastId && firstId.identifier !== lastId.identifier) {
      const result = resolver.expand('V16', lastId.identifier!, firstId.identifier!);
      assert.equal(result, undefined, 'reversed order should return undefined');
    }
  });

  it('returns undefined when fix is not on the airway', () => {
    assert.equal(resolver.expand('V16', 'XYZZY', 'PLUGH'), undefined);
  });

  it('is case-insensitive for fix identifiers', () => {
    const v16 = resolver.byDesignation('V16');
    assert.ok(v16);

    const first = v16.waypoints.find((wp) => wp.identifier);
    const last = [...v16.waypoints].reverse().find((wp) => wp.identifier);
    if (first && last && first.identifier !== last.identifier) {
      const result = resolver.expand(
        'v16',
        first.identifier!.toLowerCase(),
        last.identifier!.toUpperCase(),
      );
      assert.ok(result, 'expected case-insensitive expand to work');
    }
  });
});

describe('byFix', () => {
  it('returns airways that pass through a known fix/navaid', () => {
    const v16 = resolver.byDesignation('V16');
    assert.ok(v16);

    const wpWithId = v16.waypoints.find((wp) => wp.identifier);
    if (wpWithId) {
      const results = resolver.byFix(wpWithId.identifier!);
      assert.ok(results.length > 0, 'expected at least one airway through this fix');

      const hasV16 = results.some((r) => r.airway.designation === 'V16');
      assert.ok(hasV16, 'expected V16 in byFix results');
    }
  });

  it('is case-insensitive', () => {
    const v16 = resolver.byDesignation('V16');
    assert.ok(v16);

    const wpWithId = v16.waypoints.find((wp) => wp.identifier);
    if (wpWithId) {
      const upper = resolver.byFix(wpWithId.identifier!.toUpperCase());
      const lower = resolver.byFix(wpWithId.identifier!.toLowerCase());
      assert.equal(upper.length, lower.length);
    }
  });

  it('returns empty array for unknown fix', () => {
    assert.deepEqual(resolver.byFix('XYZZY'), []);
  });

  it('includes the waypointIndex in results', () => {
    const v16 = resolver.byDesignation('V16');
    assert.ok(v16);

    const wpWithId = v16.waypoints.find((wp) => wp.identifier);
    if (wpWithId) {
      const results = resolver.byFix(wpWithId.identifier!);
      for (const result of results) {
        assert.equal(typeof result.waypointIndex, 'number');
        assert.ok(result.waypointIndex >= 0);
        assert.ok(result.waypointIndex < result.airway.waypoints.length);
      }
    }
  });
});

describe('search', () => {
  it('finds airways matching a substring', () => {
    const results = resolver.search({ text: 'V1' });
    assert.ok(results.length > 0);
    for (const airway of results) {
      assert.ok(airway.designation.toUpperCase().includes('V1'));
    }
  });

  it('returns results in alphabetical order by designation', () => {
    const results = resolver.search({ text: 'J' });
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i - 1]!.designation.localeCompare(results[i]!.designation) <= 0,
        `expected ${results[i - 1]!.designation} <= ${results[i]!.designation}`,
      );
    }
  });

  it('respects the limit parameter', () => {
    const results = resolver.search({ text: 'V', limit: 5 });
    assert.ok(results.length <= 5);
  });

  it('filters by airway type when provided', () => {
    const results = resolver.search({
      text: '',
      types: new Set(['JET'] as const),
    });
    assert.equal(results.length, 0, 'empty text should return empty results');

    const jetResults = resolver.search({
      text: 'J',
      types: new Set(['JET'] as const),
    });
    for (const airway of jetResults) {
      assert.equal(airway.type, 'JET');
    }
  });

  it('is case-insensitive', () => {
    const upper = resolver.search({ text: 'V16' });
    const lower = resolver.search({ text: 'v16' });
    assert.equal(upper.length, lower.length);
  });

  it('returns empty array for empty text', () => {
    assert.deepEqual(resolver.search({ text: '' }), []);
  });
});
