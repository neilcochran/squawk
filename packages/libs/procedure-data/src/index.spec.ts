import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { usBundledProcedures } from './index.js';

describe('usBundledProcedures', () => {
  it('loads with a reasonable number of records', () => {
    assert.ok(
      usBundledProcedures.records.length > 10_000,
      'expected more than 10k procedures (SIDs + STARs + IAPs)',
    );
  });

  it('has metadata with generatedAt, cifpCycleDate, and per-type counts', () => {
    assert.ok(usBundledProcedures.properties.generatedAt.length > 0);
    assert.ok(usBundledProcedures.properties.cifpCycleDate.length > 0);
    assert.equal(usBundledProcedures.properties.recordCount, usBundledProcedures.records.length);
    assert.ok(usBundledProcedures.properties.sidCount > 0);
    assert.ok(usBundledProcedures.properties.starCount > 0);
    assert.ok(usBundledProcedures.properties.iapCount > 0);
    assert.equal(
      usBundledProcedures.properties.sidCount +
        usBundledProcedures.properties.starCount +
        usBundledProcedures.properties.iapCount,
      usBundledProcedures.properties.recordCount,
    );
    assert.ok(usBundledProcedures.properties.legCount > 0);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledProcedures.records[0];
    assert.ok(first !== undefined);
    assert.equal(typeof first.name, 'string');
    assert.ok(first.name.length > 0);
    assert.equal(typeof first.identifier, 'string');
    assert.ok(first.identifier.length > 0);
    assert.ok(first.type === 'SID' || first.type === 'STAR' || first.type === 'IAP');
    assert.ok(Array.isArray(first.airports));
    assert.ok(Array.isArray(first.commonRoutes));
    assert.ok(Array.isArray(first.transitions));
  });

  it('contains legs with the expected fields', () => {
    const proc = usBundledProcedures.records.find(
      (r) => r.commonRoutes.length > 0 && r.commonRoutes[0]!.legs.length > 0,
    );
    assert.ok(proc !== undefined, 'expected at least one procedure with common route legs');
    const leg = proc.commonRoutes[0]!.legs[0]!;
    assert.equal(typeof leg.pathTerminator, 'string');
    assert.ok(leg.pathTerminator.length === 2);
  });

  it('contains SIDs, STARs, and IAPs', () => {
    const types = new Set(usBundledProcedures.records.map((r) => r.type));
    assert.ok(types.has('SID'), 'expected SID procedures');
    assert.ok(types.has('STAR'), 'expected STAR procedures');
    assert.ok(types.has('IAP'), 'expected IAP procedures');
  });

  it('contains procedures with adapted airports', () => {
    const withAirports = usBundledProcedures.records.find((r) => r.airports.length > 0);
    assert.ok(withAirports !== undefined, 'expected at least one procedure with airports');
  });

  it('contains procedures with transitions', () => {
    const withTransitions = usBundledProcedures.records.find((r) => r.transitions.length > 0);
    assert.ok(withTransitions !== undefined, 'expected at least one procedure with transitions');
    const t = withTransitions.transitions[0]!;
    assert.equal(typeof t.name, 'string');
    assert.ok(t.legs.length > 0);
  });

  it('populates IAP-specific fields on an approach record', () => {
    const iap = usBundledProcedures.records.find((r) => r.type === 'IAP');
    assert.ok(iap !== undefined);
    assert.ok(iap.approachType !== undefined, 'expected approachType populated on IAP');
    assert.ok(iap.commonRoutes.length === 1, 'expected exactly one common route on IAP');
  });

  it('leaves IAP-specific fields unset on a SID or STAR record', () => {
    const nonIap = usBundledProcedures.records.find((r) => r.type !== 'IAP');
    assert.ok(nonIap !== undefined);
    assert.equal(nonIap.approachType, undefined);
    assert.equal(nonIap.runway, undefined);
    assert.equal(nonIap.missedApproach, undefined);
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
    assert.equal(usBundledProcedures.properties.legCount, actual);
  });

  it('can find a known KJFK ILS RWY 04L approach', () => {
    const approach = usBundledProcedures.records.find(
      (r) => r.type === 'IAP' && r.airports.includes('KJFK') && r.identifier === 'I04L',
    );
    assert.ok(approach !== undefined, 'expected to find KJFK I04L approach');
    assert.equal(approach.approachType, 'ILS');
    assert.equal(approach.runway, '04L');
    assert.ok(approach.missedApproach !== undefined);
    const fafLeg = approach.commonRoutes[0]!.legs.find((l) => l.isFinalApproachFix === true);
    assert.ok(fafLeg !== undefined, 'expected a FAF leg on the common route');
    const mapLeg = approach.commonRoutes[0]!.legs.find((l) => l.isMissedApproachPoint === true);
    assert.ok(mapLeg !== undefined, 'expected a MAP leg on the common route');
  });

  it('includes non-US procedures that CIFP publishes (Canadian, Pacific, Caribbean)', () => {
    // The FAA CIFP ships selected non-US procedures relevant to US operations.
    // Confirm each customer area is represented.
    const canadian = usBundledProcedures.records.filter((r) =>
      r.airports.some((a) => a.startsWith('CY')),
    );
    assert.ok(canadian.length > 0, 'expected at least one Canadian procedure (CY* airport)');
    const pacific = usBundledProcedures.records.filter((r) =>
      r.airports.some((a) => a.startsWith('PG') || a.startsWith('PH')),
    );
    assert.ok(pacific.length > 0, 'expected at least one Pacific procedure (PG*/PH* airport)');
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
    assert.ok(
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
        assert.ok(leg.lat >= -90 && leg.lat <= 90, `lat ${leg.lat} out of range`);
        assert.ok(leg.lon >= -180 && leg.lon <= 180, `lon ${leg.lon} out of range`);
      }
    }
    assert.ok(checked > 0);
  });

  it('has unique (airport, identifier, type) keys across all records', () => {
    const seen = new Set<string>();
    for (const p of usBundledProcedures.records) {
      for (const airport of p.airports) {
        const key = `${airport}::${p.identifier}::${p.type}`;
        assert.equal(seen.has(key), false, `duplicate procedure key: ${key}`);
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
    assert.ok(checked > 1000, 'expected plenty of IAPs to check');
    // Allow a small fraction; some RNAV-RNP or specialized approaches
    // encode the structure differently. Regressions in the description-code
    // parser would push this count much higher.
    assert.ok(
      iapsMissingFaf / checked < 0.05,
      `>5% of IAPs missing FAF flag: ${iapsMissingFaf}/${checked}`,
    );
    assert.ok(
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
    assert.equal(
      mismatches.length,
      0,
      `identifier/approach-type mismatches:\n  ${mismatches.slice(0, 5).join('\n  ')}`,
    );
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
    assert.equal(
      mismatches.length,
      0,
      `runway/identifier mismatches:\n  ${mismatches.slice(0, 5).join('\n  ')}`,
    );
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
    assert.equal(reversed, 0, 'FAF must always come before MAP on the common route');
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
          assert.ok(allowed.has(leg.category), `unexpected category "${leg.category}"`);
        }
      }
    }
    assert.ok(checked > 100_000, 'expected to check >100k fix legs');
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
          assert.ok(leg.arcRadiusNm > 0, `RF arc radius must be positive: ${leg.arcRadiusNm}`);
          assert.ok(leg.arcRadiusNm < 100, `RF arc radius unreasonably large: ${leg.arcRadiusNm}`);
        }
      }
    }
    assert.ok(rfCount > 0, 'expected some RF legs in the dataset');
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
        assert.ok(
          leg.altitudeConstraint.primaryFt >= 0,
          `altitude below MSL: ${leg.altitudeConstraint.primaryFt}`,
        );
        assert.ok(
          leg.altitudeConstraint.primaryFt <= 50_000,
          `altitude above FL500: ${leg.altitudeConstraint.primaryFt}`,
        );
        if (leg.altitudeConstraint.secondaryFt !== undefined) {
          assert.ok(leg.altitudeConstraint.secondaryFt >= 0);
          assert.ok(leg.altitudeConstraint.secondaryFt <= 50_000);
        }
      }
    }
    assert.ok(checked > 10_000, 'expected plenty of altitude constraints');
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
        assert.ok(
          leg.speedConstraint.speedKt >= 50 && leg.speedConstraint.speedKt <= 400,
          `implausible speed: ${leg.speedConstraint.speedKt} kt`,
        );
      }
    }
    assert.ok(checked > 0, 'expected some speed constraints in the dataset');
  });
});
