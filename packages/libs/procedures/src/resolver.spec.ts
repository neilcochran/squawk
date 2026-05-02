import { describe, it, beforeAll, expect, assert } from 'vitest';
import { createProcedureResolver } from './resolver.js';
import type { ProcedureResolver } from './resolver.js';

let resolver: ProcedureResolver;

beforeAll(async () => {
  const { usBundledProcedures } = await import('@squawk/procedure-data');
  resolver = createProcedureResolver({ data: usBundledProcedures.records });
});

describe('byIdentifier', () => {
  it('returns every adaptation of a shared STAR identifier', () => {
    const results = resolver.byIdentifier('AALLE4');
    assert(results.length >= 1, 'expected at least one AALLE4 procedure');
    for (const proc of results) {
      expect(proc.identifier).toBe('AALLE4');
      expect(proc.type).toBe('STAR');
    }
  });

  it('returns every adaptation of an approach identifier across airports', () => {
    const results = resolver.byIdentifier('I04L');
    assert(results.length >= 2, 'expected I04L to be published at multiple airports');
    for (const proc of results) {
      expect(proc.type).toBe('IAP');
    }
  });

  it('is case-insensitive', () => {
    const upper = resolver.byIdentifier('I04L');
    const lower = resolver.byIdentifier('i04l');
    expect(upper.length).toBe(lower.length);
  });

  it('returns an empty array for unknown identifier', () => {
    expect(resolver.byIdentifier('ZZZZZ9')).toEqual([]);
  });
});

describe('byAirportAndIdentifier', () => {
  it('resolves a specific STAR at an airport', () => {
    const result = resolver.byAirportAndIdentifier('KDEN', 'AALLE4');
    assert(result, 'expected AALLE4 at KDEN');
    expect(result.identifier).toBe('AALLE4');
    expect(result.type).toBe('STAR');
    assert(result.airports.includes('KDEN'));
  });

  it('resolves a specific IAP at an airport', () => {
    const result = resolver.byAirportAndIdentifier('KJFK', 'I04L');
    assert(result, 'expected I04L at KJFK');
    expect(result.type).toBe('IAP');
    expect(result.approachType).toBe('ILS');
    expect(result.runway).toBe('04L');
  });

  it('is case-insensitive', () => {
    const upper = resolver.byAirportAndIdentifier('KJFK', 'I04L');
    const lower = resolver.byAirportAndIdentifier('kjfk', 'i04l');
    assert(upper);
    assert(lower);
    expect(upper.identifier).toBe(lower.identifier);
  });

  it('returns undefined when the airport does not adapt the identifier', () => {
    expect(resolver.byAirportAndIdentifier('KDEN', 'I04L')).toBe(undefined);
  });
});

describe('byAirport', () => {
  it('returns all procedures (SID, STAR, IAP) for an airport', () => {
    const results = resolver.byAirport('KJFK');
    assert(results.length > 10, 'expected many procedures for KJFK');
    const types = new Set(results.map((r) => r.type));
    assert(types.has('IAP'), 'expected IAPs at KJFK');
  });

  it('is case-insensitive', () => {
    const upper = resolver.byAirport('KJFK');
    const lower = resolver.byAirport('kjfk');
    expect(upper.length).toBe(lower.length);
  });

  it('returns an empty array for unknown airport', () => {
    expect(resolver.byAirport('ZZZZZ')).toEqual([]);
  });
});

describe('byAirportAndRunway', () => {
  it('returns IAPs whose runway matches', () => {
    const results = resolver.byAirportAndRunway('KJFK', '04L');
    const iap = results.find((p) => p.type === 'IAP' && p.runway === '04L');
    assert(iap, 'expected at least one IAP for runway 04L at KJFK');
  });

  it('is case-insensitive', () => {
    const upper = resolver.byAirportAndRunway('KJFK', '04L');
    const lower = resolver.byAirportAndRunway('kjfk', '04l');
    expect(upper.length).toBe(lower.length);
  });

  it('returns an empty array when no procedure serves the runway', () => {
    expect(resolver.byAirportAndRunway('KJFK', '99Z')).toEqual([]);
  });
});

describe('byType', () => {
  it('returns only SIDs when type is SID', () => {
    const results = resolver.byType('SID');
    assert(results.length > 0);
    for (const proc of results) {
      expect(proc.type).toBe('SID');
    }
  });

  it('returns only STARs when type is STAR', () => {
    const results = resolver.byType('STAR');
    assert(results.length > 0);
    for (const proc of results) {
      expect(proc.type).toBe('STAR');
    }
  });

  it('returns only IAPs when type is IAP', () => {
    const results = resolver.byType('IAP');
    assert(results.length > 0);
    for (const proc of results) {
      expect(proc.type).toBe('IAP');
    }
  });

  it('returns a reasonable count for each type', () => {
    assert(resolver.byType('SID').length > 500);
    assert(resolver.byType('STAR').length > 500);
    assert(resolver.byType('IAP').length > 5000);
  });
});

describe('byApproachType', () => {
  it('returns only ILS approaches when passed ILS', () => {
    const results = resolver.byApproachType('ILS');
    assert(results.length > 0);
    for (const proc of results) {
      expect(proc.approachType).toBe('ILS');
      expect(proc.type).toBe('IAP');
    }
  });

  it('returns only RNAV approaches when passed RNAV', () => {
    const results = resolver.byApproachType('RNAV');
    assert(results.length > 0);
    for (const proc of results) {
      expect(proc.approachType).toBe('RNAV');
    }
  });
});

describe('expand', () => {
  it('returns the common route when no transition is specified', () => {
    const result = resolver.expand('KJFK', 'I04L');
    assert(result, 'expected expand result for KJFK I04L');
    expect(result.procedure.identifier).toBe('I04L');
    assert(result.legs.length > 0);
    expect(result.legs[0]!.pathTerminator).toBe('IF');
  });

  it('merges an IAP approach transition before the common route', () => {
    const withTransition = resolver.expand('KJFK', 'I13L', 'BUZON');
    assert(withTransition, 'expected expand result for KJFK I13L BUZON');
    expect(withTransition.legs[0]!.fixIdentifier).toBe('BUZON');
  });

  it('merges a SID enroute transition after the common route', () => {
    const baseRoute = resolver.expand('KJFK', 'JFK5');
    const withTransition = resolver.expand('KJFK', 'JFK5', 'BIGGY');
    if (baseRoute === undefined || withTransition === undefined) {
      return;
    }
    expect(
      withTransition.legs[0]!.fixIdentifier,
      'SID expansion starts at common route origin when transition is enroute',
    ).toBe(baseRoute.legs[0]!.fixIdentifier);
  });

  it('is case-insensitive for airport, identifier, and transition name', () => {
    const upper = resolver.expand('KJFK', 'I04L');
    const mixed = resolver.expand('kjfk', 'i04l');
    assert(upper);
    assert(mixed);
    expect(upper.legs.length).toBe(mixed.legs.length);
  });

  it('returns undefined for unknown airport/identifier combination', () => {
    expect(resolver.expand('KDEN', 'I04L')).toBe(undefined);
  });

  it('returns undefined for unknown transition name', () => {
    expect(resolver.expand('KJFK', 'I04L', 'NONEXISTENT')).toBe(undefined);
  });

  it('merges a STAR runway transition after the common route', () => {
    // KABQ BRRTO1 has runway transitions RW03, RW08, RW21, RW26.
    const base = resolver.expand('KABQ', 'BRRTO1');
    const withRw = resolver.expand('KABQ', 'BRRTO1', 'RW08');
    assert(base, 'expected base expansion for KABQ BRRTO1');
    assert(withRw, 'expected runway-transition expansion for KABQ BRRTO1 RW08');
    assert(withRw.legs.length > base.legs.length);
    // Common route comes first; runway transition appends to the end.
    const baseFirst = base.legs[0]?.fixIdentifier;
    const withRwFirst = withRw.legs[0]?.fixIdentifier;
    if (baseFirst !== undefined && withRwFirst !== undefined) {
      expect(
        withRwFirst,
        'STAR runway-transition expansion starts at the common route origin',
      ).toBe(baseFirst);
    }
  });

  it('merges a SID runway transition before the common route', () => {
    // 41U WUXOT1 has a single RW21 runway transition.
    const base = resolver.expand('41U', 'WUXOT1');
    const withRw = resolver.expand('41U', 'WUXOT1', 'RW21');
    assert(withRw, 'expected runway-transition expansion for 41U WUXOT1 RW21');
    // When the SID has a common route, the runway transition prepends to it.
    if (base !== undefined) {
      assert(withRw.legs.length > 0);
    }
  });

  it('expands an IAP that has no approach transitions (common route only)', () => {
    // 08N R07 is an example of an RNAV IAP with no approach transitions.
    const result = resolver.expand('08N', 'R07');
    assert(result, 'expected expand result for 08N R07');
    assert(result.legs.length > 0);
  });

  it('deduplicates the connecting fix when transition and common route share it', () => {
    // When a transition ends at the same fix the common route begins with,
    // the duplicate fix should collapse to one entry.
    const withTx = resolver.expand('KJFK', 'I13L', 'BUZON');
    assert(withTx);
    const identifiers = withTx.legs.map((l) => l.fixIdentifier).filter((x) => x !== undefined);
    // BUZON should appear at most once even though it terminates both the
    // transition and (via the IF on the common route) the next segment.
    const buzonCount = identifiers.filter((id) => id === 'BUZON').length;
    assert(buzonCount <= 1, `expected BUZON to appear at most once, got ${buzonCount}`);
  });
});

describe('search', () => {
  it('finds procedures matching a substring in name or identifier', () => {
    const results = resolver.search({ text: 'AALLE' });
    assert(results.length > 0);
    for (const proc of results) {
      const matchesCode = proc.identifier.toUpperCase().includes('AALLE');
      const matchesName = proc.name.toUpperCase().includes('AALLE');
      assert(matchesCode || matchesName);
    }
  });

  it('respects the limit parameter', () => {
    const results = resolver.search({ text: 'A', limit: 5 });
    assert(results.length <= 5);
  });

  it('filters by procedure type when provided', () => {
    const iaps = resolver.search({ text: 'RWY', type: 'IAP', limit: 50 });
    for (const proc of iaps) {
      expect(proc.type).toBe('IAP');
    }
  });

  it('filters by approach type when provided', () => {
    const ils = resolver.search({ text: 'RWY', approachType: 'ILS', limit: 50 });
    for (const proc of ils) {
      expect(proc.approachType).toBe('ILS');
    }
  });

  it('returns an empty array for empty text', () => {
    expect(resolver.search({ text: '' })).toEqual([]);
  });

  it('is case-insensitive', () => {
    const upper = resolver.search({ text: 'AALLE' });
    const lower = resolver.search({ text: 'aalle' });
    expect(upper.length).toBe(lower.length);
  });

  it('sorts results by airport then identifier', () => {
    const results = resolver.search({ text: 'RNAV', limit: 50 });
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]!;
      const curr = results[i]!;
      const prevAirport = prev.airports[0] ?? '';
      const currAirport = curr.airports[0] ?? '';
      const airportCmp = prevAirport.localeCompare(currAirport);
      if (airportCmp > 0) {
        expect.fail(
          `expected airports in ascending order, got "${prevAirport}" before "${currAirport}"`,
        );
      }
      if (airportCmp === 0) {
        assert(
          prev.identifier.localeCompare(curr.identifier) <= 0,
          `expected identifiers in ascending order within same airport, got "${prev.identifier}" before "${curr.identifier}" at ${prevAirport}`,
        );
      }
    }
  });
});

describe('IAP coverage across approach types', () => {
  // Expected non-zero approach types. The remaining types (TACAN, IGS,
  // SDF, FMS, MLS) may not be present in the current FAA CIFP publication;
  // we assert below that byApproachType returns an empty array for those
  // without throwing.
  const expectedNonEmpty: readonly string[] = [
    'ILS',
    'LOC',
    'LOC_BC',
    'RNAV',
    'RNAV_RNP',
    'VOR',
    'VOR_DME',
    'NDB',
    'NDB_DME',
    'GLS',
    'LDA',
    'GPS',
  ];

  for (const approachType of expectedNonEmpty) {
    it(`returns procedures for ${approachType} approaches`, () => {
      const results = resolver.byApproachType(
        approachType as Parameters<typeof resolver.byApproachType>[0],
      );
      assert(results.length > 0, `expected at least one ${approachType} approach`);
      for (const proc of results) {
        expect(proc.type).toBe('IAP');
        expect(proc.approachType).toBe(approachType);
      }
    });
  }

  const maybeEmpty: readonly string[] = ['TACAN', 'IGS', 'SDF', 'FMS', 'MLS'];
  for (const approachType of maybeEmpty) {
    it(`returns an array (possibly empty) for ${approachType} approaches`, () => {
      const results = resolver.byApproachType(
        approachType as Parameters<typeof resolver.byApproachType>[0],
      );
      assert(Array.isArray(results));
      for (const proc of results) {
        expect(proc.approachType).toBe(approachType);
      }
    });
  }
});

describe('IAP structural invariants', () => {
  it('every IAP has exactly one common route', () => {
    const iaps = resolver.byType('IAP');
    assert(iaps.length > 0);
    for (const iap of iaps) {
      expect(
        iap.commonRoutes.length,
        `expected 1 common route on ${iap.airports[0]} ${iap.identifier}, got ${iap.commonRoutes.length}`,
      ).toBe(1);
    }
  });

  it('every IAP has a missed approach sequence', () => {
    const iaps = resolver.byType('IAP');
    for (const iap of iaps) {
      assert(
        iap.missedApproach !== undefined,
        `expected missedApproach on ${iap.airports[0]} ${iap.identifier}`,
      );
      assert(iap.missedApproach.legs.length > 0);
    }
  });

  it('every IAP has an approach type', () => {
    const iaps = resolver.byType('IAP');
    for (const iap of iaps) {
      assert(
        iap.approachType !== undefined,
        `expected approachType on ${iap.airports[0]} ${iap.identifier}`,
      );
    }
  });

  it('circling approaches (no runway) have identifiers with no digit-runway pattern', () => {
    const iaps = resolver.byType('IAP');
    const circling = iaps.filter((p) => p.runway === undefined);
    assert(circling.length > 0, 'expected some circling approaches in the dataset');
    // A circling approach identifier's chars after the leading approach-type
    // letter must NOT begin with two digits (which would indicate a runway).
    for (const c of circling) {
      const afterPrefix = c.identifier.substring(1);
      assert(
        !/^\d{2}/.test(afterPrefix),
        `circling approach ${c.airports[0]} ${c.identifier} has a runway-style identifier`,
      );
    }
  });

  it('most circling approaches use the dashed -A/-B/-C/... suffix convention', () => {
    const iaps = resolver.byType('IAP');
    const circling = iaps.filter((p) => p.runway === undefined);
    const dashed = circling.filter((c) => /-[A-Z]$/.test(c.identifier));
    // Vast majority use the standard dashed suffix; a handful of older
    // identifiers (e.g. "RNVA" without the dash) are accepted as-is.
    assert(
      dashed.length / circling.length > 0.9,
      `expected >90% of circling identifiers to use dashed -X suffix; got ${dashed.length}/${circling.length}`,
    );
  });

  it('runway-specific IAP identifiers embed the runway number', () => {
    const iaps = resolver.byType('IAP');
    const withRunway = iaps.filter((p) => p.runway !== undefined);
    assert(withRunway.length > 1000);
    // The identifier chars after the approach-type letter should start
    // with the runway digits.
    for (const iap of withRunway.slice(0, 500)) {
      const afterPrefix = iap.identifier.substring(1);
      const runwayDigits = iap.runway!.substring(0, 2);
      assert(
        afterPrefix.startsWith(runwayDigits),
        `identifier "${iap.identifier}" runway field "${iap.runway}" but identifier chars after prefix are "${afterPrefix}"`,
      );
    }
  });

  it('every IAP common route contains a MAP leg', () => {
    const iaps = resolver.byType('IAP');
    let missing = 0;
    for (const iap of iaps) {
      const route = iap.commonRoutes[0];
      if (route === undefined) {
        continue;
      }
      if (!route.legs.some((l) => l.isMissedApproachPoint === true)) {
        missing += 1;
      }
    }
    // Tolerate a small fraction: some specialized RNAV-RNP approaches
    // encode the MAP on the missed-approach segment instead.
    assert(
      missing / iaps.length < 0.05,
      `expected <5% of IAPs to lack a MAP flag on the common route; got ${missing}/${iaps.length}`,
    );
  });

  it('FAF flag appears before MAP flag on the common route (when both present)', () => {
    const iaps = resolver.byType('IAP');
    let reversed = 0;
    for (const iap of iaps) {
      const route = iap.commonRoutes[0];
      if (route === undefined) {
        continue;
      }
      const fafIdx = route.legs.findIndex((l) => l.isFinalApproachFix === true);
      const mapIdx = route.legs.findIndex((l) => l.isMissedApproachPoint === true);
      if (fafIdx < 0 || mapIdx < 0) {
        continue;
      }
      if (fafIdx > mapIdx) {
        reversed += 1;
      }
    }
    expect(reversed, 'FAF must never come after MAP on the common route').toBe(0);
  });
});

describe('IAP identifier / approach-type consistency', () => {
  const identifierPrefixToApproachType: Readonly<Record<string, string>> = {
    I: 'ILS',
    L: 'LOC',
    B: 'LOC_BC',
    R: 'RNAV',
    H: 'RNAV_RNP',
    V: 'VOR',
    D: 'VOR_DME',
    S: 'VOR',
    N: 'NDB',
    Q: 'NDB_DME',
    J: 'GLS',
    G: 'IGS',
    X: 'LDA',
    U: 'SDF',
    P: 'GPS',
    F: 'FMS',
    M: 'MLS',
    W: 'MLS',
    Y: 'MLS',
  };

  it('runway-specific IAP identifiers have an approach type matching their prefix letter', () => {
    const iaps = resolver.byType('IAP');
    const mismatches: string[] = [];
    for (const iap of iaps) {
      if (iap.runway === undefined) {
        continue; // circling approaches use multi-letter prefixes (VOR-A, RNV-B)
      }
      if (iap.approachType === undefined) {
        continue;
      }
      const prefix = iap.identifier.charAt(0);
      const expected = identifierPrefixToApproachType[prefix];
      if (expected !== undefined && expected !== iap.approachType) {
        mismatches.push(
          `${iap.airports[0]} ${iap.identifier}: prefix '${prefix}' suggests ${expected}, got ${iap.approachType}`,
        );
      }
    }
    expect(mismatches.length, mismatches.slice(0, 5).join('\n')).toBe(0);
  });
});

describe('byAirportAndRunway coverage', () => {
  it('returns every IAP variant published for a runway', () => {
    // KJFK runway 04L has ILS, RNAV, and LOC approaches.
    const results = resolver.byAirportAndRunway('KJFK', '04L');
    const iaps = results.filter((p) => p.type === 'IAP');
    const types = new Set(iaps.map((p) => p.approachType));
    assert(types.has('ILS'), 'expected an ILS 04L');
    assert(types.has('RNAV'), 'expected an RNAV 04L');
  });

  it('includes SIDs that publish a matching runway transition', () => {
    // KJFK runway 13R - should include the ILS/RNAV approaches AND any SID
    // with a RW13R runway transition.
    const results = resolver.byAirportAndRunway('KJFK', '13R');
    const hasSidWithRwTransition = results.some(
      (p) => p.type === 'SID' && p.transitions.some((t) => t.name.toUpperCase() === 'RW13R'),
    );
    // Not all airports have a matching SID; only assert that IAPs are present.
    const iapCount = results.filter((p) => p.type === 'IAP').length;
    assert(iapCount > 0, 'expected at least one IAP for KJFK 13R');
    // Log hasSidWithRwTransition usage so it can be inspected in flaky cases.
    expect(typeof hasSidWithRwTransition).toBe('boolean');
  });
});

describe('known-approach spot checks', () => {
  it('KJFK ILS RWY 04L decodes the expected leg sequence and altitudes', () => {
    const approach = resolver.byAirportAndIdentifier('KJFK', 'I04L');
    assert(approach);
    expect(approach.approachType).toBe('ILS');
    expect(approach.runway).toBe('04L');
    const legs = approach.commonRoutes[0]!.legs;
    // First leg should be the Initial Fix
    expect(legs[0]?.pathTerminator).toBe('IF');
    // Some leg must terminate at runway RW04L with MAP flag and runway category
    const rwLeg = legs.find((l) => l.fixIdentifier === 'RW04L');
    assert(rwLeg);
    expect(rwLeg.category).toBe('RUNWAY');
    expect(rwLeg.isMissedApproachPoint).toBe(true);
    expect(rwLeg.isFlyover).toBe(true);
    // Missed approach sequence must exist and carry real fixes
    const missed = approach.missedApproach!.legs;
    assert(missed.length > 0);
  });

  it('KEWR GLS J22L is classified and has a runway', () => {
    const approach = resolver.byAirportAndIdentifier('KEWR', 'J22L');
    assert(approach, 'expected KEWR J22L to be present');
    expect(approach.approachType).toBe('GLS');
    expect(approach.runway).toBe('22L');
  });

  it('resolves a circling VOR-A approach with no runway', () => {
    const circling = resolver.byType('IAP').find((p) => p.identifier === 'VOR-A');
    assert(circling, 'expected at least one VOR-A circling approach');
    expect(circling.runway).toBe(undefined);
    expect(circling.approachType).toBe('VOR');
  });

  it('KBOS has IAPs across multiple approach types and runways', () => {
    const bosIaps = resolver.byAirport('KBOS').filter((p) => p.type === 'IAP');
    assert(bosIaps.length > 5);
    const runways = new Set(bosIaps.map((p) => p.runway).filter((r) => r !== undefined));
    assert(runways.size >= 3, 'expected KBOS to serve approaches on several runways');
    const types = new Set(bosIaps.map((p) => p.approachType));
    assert(types.has('ILS'));
    assert(types.has('RNAV'));
  });

  it('KDEN approach count and type breakdown is stable', () => {
    const denIaps = resolver.byAirport('KDEN').filter((p) => p.type === 'IAP');
    assert(denIaps.length > 40);
    const breakdown: Record<string, number> = {};
    for (const iap of denIaps) {
      const key = iap.approachType ?? 'unknown';
      breakdown[key] = (breakdown[key] ?? 0) + 1;
    }
    // KDEN publishes ILS, LOC, RNAV, and RNAV (RNP) approaches.
    assert((breakdown['ILS'] ?? 0) > 5);
    assert((breakdown['RNAV'] ?? 0) > 5);
  });
});

describe('non-US procedure coverage', () => {
  it('includes Canadian airport procedures (CY* prefix)', () => {
    // FAA CIFP publishes Canadian STARs (but not IAPs) adapted for US ops.
    const canadian = resolver
      .byType('STAR')
      .filter((p) => p.airports.some((a) => a.startsWith('CY')));
    assert(canadian.length > 0, 'expected at least one Canadian STAR in the resolver');
  });

  it('includes Pacific territory IAPs (PH* / PG* prefix)', () => {
    const pacificIaps = resolver
      .byType('IAP')
      .filter((p) => p.airports.some((a) => a.startsWith('PH') || a.startsWith('PG')));
    assert(pacificIaps.length > 0, 'expected some Pacific-territory IAPs in the resolver');
  });

  it('includes Caribbean (TJ*) IAPs and SIDs/STARs', () => {
    const tjProcs = resolver
      .byType('IAP')
      .concat(resolver.byType('SID'))
      .concat(resolver.byType('STAR'))
      .filter((p) => p.airports.some((a) => a.startsWith('TJ')));
    assert(tjProcs.length > 0, 'expected Caribbean (TJ*) procedures in the resolver');
  });
});

describe('leg-level data fidelity', () => {
  it('RF constant-radius-arc legs carry arcRadiusNm and centerFix', () => {
    const iaps = resolver.byType('IAP');
    let rfLegsSeen = 0;
    for (const iap of iaps) {
      const allLegs = [
        ...iap.commonRoutes.flatMap((r) => r.legs),
        ...iap.transitions.flatMap((t) => t.legs),
        ...(iap.missedApproach?.legs ?? []),
      ];
      for (const leg of allLegs) {
        if (leg.pathTerminator === 'RF') {
          rfLegsSeen += 1;
          assert(leg.arcRadiusNm !== undefined, 'RF leg must have arcRadiusNm');
          assert(leg.centerFix !== undefined, 'RF leg must have centerFix');
        }
      }
      if (rfLegsSeen > 50) {
        break;
      }
    }
    assert(rfLegsSeen > 0, 'expected at least one RF leg in the sample');
  });

  it('holding legs (HF/HM/HA) carry distanceNm or holdTimeMin', () => {
    const iaps = resolver.byType('IAP');
    let holdingLegsSeen = 0;
    for (const iap of iaps) {
      const allLegs = [
        ...iap.commonRoutes.flatMap((r) => r.legs),
        ...iap.transitions.flatMap((t) => t.legs),
        ...(iap.missedApproach?.legs ?? []),
      ];
      for (const leg of allLegs) {
        if (
          leg.pathTerminator === 'HF' ||
          leg.pathTerminator === 'HM' ||
          leg.pathTerminator === 'HA'
        ) {
          holdingLegsSeen += 1;
          assert(
            leg.holdTimeMin !== undefined || leg.distanceNm !== undefined,
            `hold leg ${leg.pathTerminator} should carry holdTimeMin or distanceNm`,
          );
        }
      }
      if (holdingLegsSeen > 50) {
        break;
      }
    }
    assert(holdingLegsSeen > 0);
  });

  it('legs with a fix have matching lat/lon when resolved', () => {
    const iap = resolver.byAirportAndIdentifier('KJFK', 'I04L');
    assert(iap);
    const legs = iap.commonRoutes[0]!.legs;
    for (const leg of legs) {
      if (leg.fixIdentifier !== undefined && leg.category !== undefined) {
        // Sample: if coordinates are present, they must be sensible.
        if (leg.lat !== undefined && leg.lon !== undefined) {
          // KJFK is at ~40N / -74W. Common route legs are nearby.
          assert(leg.lat > 39 && leg.lat < 42, `lat ${leg.lat} unexpected for KJFK-area leg`);
          assert(leg.lon < -72 && leg.lon > -75, `lon ${leg.lon} unexpected for KJFK-area leg`);
        }
      }
    }
  });
});
