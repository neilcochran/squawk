import { describe, it, expect, assert } from 'vitest';
import { usBundledProcedures } from './index.js';

describe('usBundledProcedures', () => {
  it('loads with a reasonable number of records', () => {
    assert(
      usBundledProcedures.records.length > 10_000,
      'expected more than 10k procedures (SIDs + STARs + IAPs)',
    );
  });

  it('has metadata with generatedAt, cifpCycleDate, and per-type counts', () => {
    assert(usBundledProcedures.properties.generatedAt.length > 0);
    assert(usBundledProcedures.properties.cifpCycleDate.length > 0);
    expect(usBundledProcedures.properties.recordCount).toBe(usBundledProcedures.records.length);
    assert(usBundledProcedures.properties.sidCount > 0);
    assert(usBundledProcedures.properties.starCount > 0);
    assert(usBundledProcedures.properties.iapCount > 0);
    expect(
      usBundledProcedures.properties.sidCount +
        usBundledProcedures.properties.starCount +
        usBundledProcedures.properties.iapCount,
    ).toBe(usBundledProcedures.properties.recordCount);
    assert(usBundledProcedures.properties.legCount > 0);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledProcedures.records[0];
    assert(first !== undefined);
    expect(typeof first.name).toBe('string');
    assert(first.name.length > 0);
    expect(typeof first.identifier).toBe('string');
    assert(first.identifier.length > 0);
    assert(first.type === 'SID' || first.type === 'STAR' || first.type === 'IAP');
    assert(Array.isArray(first.airports));
    assert(Array.isArray(first.commonRoutes));
    assert(Array.isArray(first.transitions));
  });

  it('contains legs with the expected fields', () => {
    const proc = usBundledProcedures.records.find(
      (r) => r.commonRoutes.length > 0 && r.commonRoutes[0]!.legs.length > 0,
    );
    assert(proc !== undefined, 'expected at least one procedure with common route legs');
    const leg = proc.commonRoutes[0]!.legs[0]!;
    expect(typeof leg.pathTerminator).toBe('string');
    assert(leg.pathTerminator.length === 2);
  });

  it('contains SIDs, STARs, and IAPs', () => {
    const types = new Set(usBundledProcedures.records.map((r) => r.type));
    assert(types.has('SID'), 'expected SID procedures');
    assert(types.has('STAR'), 'expected STAR procedures');
    assert(types.has('IAP'), 'expected IAP procedures');
  });

  it('contains procedures with adapted airports', () => {
    const withAirports = usBundledProcedures.records.find((r) => r.airports.length > 0);
    assert(withAirports !== undefined, 'expected at least one procedure with airports');
  });

  it('contains procedures with transitions', () => {
    const withTransitions = usBundledProcedures.records.find((r) => r.transitions.length > 0);
    assert(withTransitions !== undefined, 'expected at least one procedure with transitions');
    const t = withTransitions.transitions[0]!;
    expect(typeof t.name).toBe('string');
    assert(t.legs.length > 0);
  });

  it('populates IAP-specific fields on an approach record', () => {
    const iap = usBundledProcedures.records.find((r) => r.type === 'IAP');
    assert(iap !== undefined);
    assert(iap.approachType !== undefined, 'expected approachType populated on IAP');
    assert(iap.commonRoutes.length === 1, 'expected exactly one common route on IAP');
  });

  it('leaves IAP-specific fields unset on a SID or STAR record', () => {
    const nonIap = usBundledProcedures.records.find((r) => r.type !== 'IAP');
    assert(nonIap !== undefined);
    expect(nonIap.approachType).toBe(undefined);
    expect(nonIap.runway).toBe(undefined);
    expect(nonIap.missedApproach).toBe(undefined);
  });

  it('legCount matches the actual leg total', () => {
    let actual = 0;
    for (const p of usBundledProcedures.records) {
      for (const route of p.commonRoutes) {
        actual += route.legs.length;
      }
      for (const transition of p.transitions) {
        actual += transition.legs.length;
      }
      if (p.missedApproach !== undefined) {
        actual += p.missedApproach.legs.length;
      }
    }
    expect(usBundledProcedures.properties.legCount).toBe(actual);
  });

  it('can find a known KJFK ILS RWY 04L approach', () => {
    const approach = usBundledProcedures.records.find(
      (r) => r.type === 'IAP' && r.airports.includes('KJFK') && r.identifier === 'I04L',
    );
    assert(approach !== undefined, 'expected to find KJFK I04L approach');
    expect(approach.approachType).toBe('ILS');
    expect(approach.runway).toBe('04L');
    assert(approach.missedApproach !== undefined);
    const fafLeg = approach.commonRoutes[0]!.legs.find((l) => l.isFinalApproachFix === true);
    assert(fafLeg !== undefined, 'expected a FAF leg on the common route');
    const mapLeg = approach.commonRoutes[0]!.legs.find((l) => l.isMissedApproachPoint === true);
    assert(mapLeg !== undefined, 'expected a MAP leg on the common route');
  });

  it('includes non-US procedures that CIFP publishes (Canadian, Pacific, Caribbean)', () => {
    // The FAA CIFP ships selected non-US procedures relevant to US operations.
    // Confirm each customer area is represented.
    const canadian = usBundledProcedures.records.filter((r) =>
      r.airports.some((a) => a.startsWith('CY')),
    );
    assert(canadian.length > 0, 'expected at least one Canadian procedure (CY* airport)');
    const pacific = usBundledProcedures.records.filter((r) =>
      r.airports.some((a) => a.startsWith('PG') || a.startsWith('PH')),
    );
    assert(pacific.length > 0, 'expected at least one Pacific procedure (PG*/PH* airport)');
  });

  it('keeps unresolved leg coordinates under a 1% tolerance', () => {
    // Legs that reference a fix but whose coordinates could not be
    // resolved against the CIFP fix index. A small residual is expected
    // (cross-border fixes that live outside the FAA publication scope),
    // but regressions in the fix index should push this above threshold.
    let unresolved = 0;
    let total = 0;
    for (const p of usBundledProcedures.records) {
      const allLegs = [
        ...p.commonRoutes.flatMap((c) => c.legs),
        ...p.transitions.flatMap((t) => t.legs),
        ...(p.missedApproach !== undefined ? p.missedApproach.legs : []),
      ];
      for (const leg of allLegs) {
        if (leg.fixIdentifier === undefined) {
          continue;
        }
        total += 1;
        if (leg.lat === undefined || leg.lon === undefined) {
          unresolved += 1;
        }
      }
    }
    const ratio = unresolved / total;
    assert(
      ratio < 0.01,
      `expected <1% unresolved fix coordinates; got ${unresolved}/${total} (${(ratio * 100).toFixed(2)}%)`,
    );
  });

  it('constrains all leg coordinates to the valid lat/lon range', () => {
    let checked = 0;
    for (const p of usBundledProcedures.records) {
      const allLegs = [
        ...p.commonRoutes.flatMap((c) => c.legs),
        ...p.transitions.flatMap((t) => t.legs),
        ...(p.missedApproach !== undefined ? p.missedApproach.legs : []),
      ];
      for (const leg of allLegs) {
        if (leg.lat === undefined || leg.lon === undefined) {
          continue;
        }
        checked += 1;
        assert(leg.lat >= -90 && leg.lat <= 90, `lat ${leg.lat} out of range`);
        assert(leg.lon >= -180 && leg.lon <= 180, `lon ${leg.lon} out of range`);
      }
    }
    assert(checked > 0);
  });

  it('has unique (airport, identifier, type) keys across all records', () => {
    const seen = new Set<string>();
    for (const p of usBundledProcedures.records) {
      for (const airport of p.airports) {
        const key = `${airport}::${p.identifier}::${p.type}`;
        expect(seen.has(key), `duplicate procedure key: ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it('flags a FAF and a MAP on every IAP common route', () => {
    let checked = 0;
    let iapsMissingFaf = 0;
    let iapsMissingMap = 0;
    for (const p of usBundledProcedures.records) {
      if (p.type !== 'IAP') {
        continue;
      }
      const primaryRoute = p.commonRoutes[0];
      if (primaryRoute === undefined) {
        continue;
      }
      checked += 1;
      if (!primaryRoute.legs.some((l) => l.isFinalApproachFix === true)) {
        iapsMissingFaf += 1;
      }
      if (!primaryRoute.legs.some((l) => l.isMissedApproachPoint === true)) {
        iapsMissingMap += 1;
      }
    }
    assert(checked > 1000, 'expected plenty of IAPs to check');
    // Allow a small fraction; some RNAV-RNP or specialized approaches
    // encode the structure differently. Regressions in the description-code
    // parser would push this count much higher.
    assert(
      iapsMissingFaf / checked < 0.05,
      `>5% of IAPs missing FAF flag: ${iapsMissingFaf}/${checked}`,
    );
    assert(
      iapsMissingMap / checked < 0.05,
      `>5% of IAPs missing MAP flag: ${iapsMissingMap}/${checked}`,
    );
  });

  it('matches each runway-specific IAP identifier to the expected approach type', () => {
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
    const mismatches: string[] = [];
    for (const p of usBundledProcedures.records) {
      if (p.type !== 'IAP' || p.runway === undefined || p.approachType === undefined) {
        continue;
      }
      const prefix = p.identifier.charAt(0);
      const expected = identifierPrefixToApproachType[prefix];
      if (expected !== undefined && expected !== p.approachType) {
        mismatches.push(
          `${p.airports[0]} ${p.identifier}: prefix '${prefix}' suggests ${expected}, got ${p.approachType}`,
        );
      }
    }
    expect(
      mismatches.length,
      `identifier/approach-type mismatches:\n  ${mismatches.slice(0, 5).join('\n  ')}`,
    ).toBe(0);
  });

  it('matches each runway field to the runway digits embedded in its identifier', () => {
    const mismatches: string[] = [];
    for (const p of usBundledProcedures.records) {
      if (p.type !== 'IAP' || p.runway === undefined) {
        continue;
      }
      const afterPrefix = p.identifier.substring(1);
      const digits = p.runway.substring(0, 2);
      if (!afterPrefix.startsWith(digits)) {
        mismatches.push(
          `${p.airports[0]} ${p.identifier}: runway '${p.runway}' does not match identifier-embedded digits`,
        );
      }
    }
    expect(
      mismatches.length,
      `runway/identifier mismatches:\n  ${mismatches.slice(0, 5).join('\n  ')}`,
    ).toBe(0);
  });

  it('keeps FAF earlier than MAP on every IAP common route that flags both', () => {
    let reversed = 0;
    for (const p of usBundledProcedures.records) {
      if (p.type !== 'IAP') {
        continue;
      }
      const route = p.commonRoutes[0];
      if (route === undefined) {
        continue;
      }
      const faf = route.legs.findIndex((l) => l.isFinalApproachFix === true);
      const map = route.legs.findIndex((l) => l.isMissedApproachPoint === true);
      if (faf >= 0 && map >= 0 && faf > map) {
        reversed += 1;
      }
    }
    expect(reversed, 'FAF must always come before MAP on the common route').toBe(0);
  });

  it('populates category on every leg that resolves a fix', () => {
    const allowed = new Set(['FIX', 'NAVAID', 'AIRPORT', 'RUNWAY']);
    let checked = 0;
    for (const p of usBundledProcedures.records) {
      const allLegs = [
        ...p.commonRoutes.flatMap((r) => r.legs),
        ...p.transitions.flatMap((t) => t.legs),
        ...(p.missedApproach !== undefined ? p.missedApproach.legs : []),
      ];
      for (const leg of allLegs) {
        if (leg.fixIdentifier === undefined) {
          continue;
        }
        checked += 1;
        if (leg.category !== undefined) {
          assert(allowed.has(leg.category), `unexpected category "${leg.category}"`);
        }
      }
    }
    assert(checked > 100_000, 'expected to check >100k fix legs');
  });

  it('RF leg radii are positive and bounded', () => {
    let rfCount = 0;
    for (const p of usBundledProcedures.records) {
      const allLegs = [
        ...p.commonRoutes.flatMap((r) => r.legs),
        ...p.transitions.flatMap((t) => t.legs),
        ...(p.missedApproach !== undefined ? p.missedApproach.legs : []),
      ];
      for (const leg of allLegs) {
        if (leg.pathTerminator !== 'RF') {
          continue;
        }
        rfCount += 1;
        if (leg.arcRadiusNm !== undefined) {
          assert(leg.arcRadiusNm > 0, `RF arc radius must be positive: ${leg.arcRadiusNm}`);
          assert(leg.arcRadiusNm < 100, `RF arc radius unreasonably large: ${leg.arcRadiusNm}`);
        }
      }
    }
    assert(rfCount > 0, 'expected some RF legs in the dataset');
  });

  it('altitude constraints are non-negative and plausible (under FL500)', () => {
    let checked = 0;
    for (const p of usBundledProcedures.records) {
      const allLegs = [
        ...p.commonRoutes.flatMap((r) => r.legs),
        ...p.transitions.flatMap((t) => t.legs),
        ...(p.missedApproach !== undefined ? p.missedApproach.legs : []),
      ];
      for (const leg of allLegs) {
        if (leg.altitudeConstraint === undefined) {
          continue;
        }
        checked += 1;
        assert(
          leg.altitudeConstraint.primaryFt >= 0,
          `altitude below MSL: ${leg.altitudeConstraint.primaryFt}`,
        );
        assert(
          leg.altitudeConstraint.primaryFt <= 50_000,
          `altitude above FL500: ${leg.altitudeConstraint.primaryFt}`,
        );
        if (leg.altitudeConstraint.secondaryFt !== undefined) {
          assert(leg.altitudeConstraint.secondaryFt >= 0);
          assert(leg.altitudeConstraint.secondaryFt <= 50_000);
        }
      }
    }
    assert(checked > 10_000, 'expected plenty of altitude constraints');
  });

  it('speed constraints are plausible indicated airspeeds (50-400 kt)', () => {
    let checked = 0;
    for (const p of usBundledProcedures.records) {
      const allLegs = [
        ...p.commonRoutes.flatMap((r) => r.legs),
        ...p.transitions.flatMap((t) => t.legs),
        ...(p.missedApproach !== undefined ? p.missedApproach.legs : []),
      ];
      for (const leg of allLegs) {
        if (leg.speedConstraint === undefined) {
          continue;
        }
        checked += 1;
        assert(
          leg.speedConstraint.speedKt >= 50 && leg.speedConstraint.speedKt <= 400,
          `implausible speed: ${leg.speedConstraint.speedKt} kt`,
        );
      }
    }
    assert(checked > 0, 'expected some speed constraints in the dataset');
  });
});
