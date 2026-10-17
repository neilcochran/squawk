import { describe, it, expect, assert } from 'vitest';

import type { Procedure, ProcedureLeg } from '@squawk/types';

import { usBundledProcedures } from './node.js';

/**
 * Number of decimal places in a number's shortest decimal representation,
 * reading exponent notation (`1.5e-7` has 8).
 */
function decimalPlaces(value: number): number {
  const [mantissa = '', exponent] = String(Math.abs(value)).split('e');
  const fraction = mantissa.split('.')[1] ?? '';
  const shift = exponent === undefined ? 0 : -Number(exponent);
  return Math.max(0, fraction.length + shift);
}

/**
 * Great-circle distance in nautical miles between two points.
 */
function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.sqrt(h));
}

/**
 * Every leg sequence of a procedure: each common route, each transition
 * and the missed approach.
 */
function legSequences(procedure: Procedure): ProcedureLeg[][] {
  return [
    ...procedure.commonRoutes.map((route) => route.legs),
    ...procedure.transitions.map((transition) => transition.legs),
    ...(procedure.missedApproach !== undefined ? [procedure.missedApproach.legs] : []),
  ];
}

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

  it('resolves runway legs against the procedure airport', () => {
    // 00U (Hardin, MT) RNAV RWY 26 must end on Hardin's own runway 26, not on
    // the runway 26 of whichever other airport in the region was read last.
    const hardin = usBundledProcedures.records.find(
      (r) => r.airports.includes('00U') && r.identifier === 'R26',
    );
    assert(hardin !== undefined, 'expected 00U R26');
    const runwayLeg = legSequences(hardin)
      .flat()
      .find((l) => l.category === 'RUNWAY' && l.fixIdentifier === 'RW26');
    assert(runwayLeg?.lat !== undefined && runwayLeg.lon !== undefined);
    expect(distanceNm(runwayLeg.lat, runwayLeg.lon, 45.7444, -107.6517)).toBeLessThan(0.5);
  });

  it('keeps every airport runway legs within one airfield of each other', () => {
    // All runway thresholds referenced by an airport's procedures belong to
    // that airport, so they cannot be spread over more than a few miles.
    const bounds = new Map<
      string,
      { minLat: number; maxLat: number; minLon: number; maxLon: number }
    >();
    for (const p of usBundledProcedures.records) {
      const airport = p.airports[0];
      if (airport === undefined) {
        continue;
      }
      for (const leg of legSequences(p).flat()) {
        if (leg.category !== 'RUNWAY' || leg.lat === undefined || leg.lon === undefined) {
          continue;
        }
        const b = bounds.get(airport);
        if (b === undefined) {
          bounds.set(airport, {
            minLat: leg.lat,
            maxLat: leg.lat,
            minLon: leg.lon,
            maxLon: leg.lon,
          });
        } else {
          b.minLat = Math.min(b.minLat, leg.lat);
          b.maxLat = Math.max(b.maxLat, leg.lat);
          b.minLon = Math.min(b.minLon, leg.lon);
          b.maxLon = Math.max(b.maxLon, leg.lon);
        }
      }
    }
    assert(bounds.size > 1000, 'expected runway legs at more than 1,000 airports');
    const spread: string[] = [];
    for (const [airport, b] of bounds) {
      const diagonalNm = distanceNm(b.minLat, b.minLon, b.maxLat, b.maxLon);
      if (diagonalNm > 10) {
        spread.push(`${airport}: ${diagonalNm.toFixed(1)} nm`);
      }
    }
    expect(spread, `runway legs spread over more than 10 nm:\n  ${spread.join('\n  ')}`).toEqual(
      [],
    );
  });

  it('RF arc radii are consistent with the chord from the preceding fix', () => {
    // The preceding fix and the RF leg's own fix both lie on the arc, so their
    // separation cannot exceed the arc's diameter. A radius scaled by the wrong
    // power of ten fails this on nearly every leg.
    let checked = 0;
    const violations: string[] = [];
    for (const p of usBundledProcedures.records) {
      for (const legs of legSequences(p)) {
        for (let i = 1; i < legs.length; i++) {
          const leg = legs[i];
          const previous = legs[i - 1];
          if (
            leg === undefined ||
            previous === undefined ||
            leg.pathTerminator !== 'RF' ||
            leg.arcRadiusNm === undefined ||
            leg.lat === undefined ||
            leg.lon === undefined ||
            previous.lat === undefined ||
            previous.lon === undefined
          ) {
            continue;
          }
          checked += 1;
          const chordNm = distanceNm(previous.lat, previous.lon, leg.lat, leg.lon);
          if (chordNm > 2 * leg.arcRadiusNm * 1.02 + 0.05) {
            violations.push(
              `${p.airports[0]} ${p.identifier} ${previous.fixIdentifier}->${leg.fixIdentifier}: chord ${chordNm.toFixed(2)} nm, radius ${leg.arcRadiusNm} nm`,
            );
          }
        }
      }
    }
    assert(checked > 1000, 'expected more than 1,000 RF legs with resolvable chords');
    expect(
      violations.length,
      `RF chords longer than the arc diameter:\n  ${violations.slice(0, 5).join('\n  ')}`,
    ).toBe(0);
  });

  it('uses all three speed descriptors, with mandatory (@) the common STAR case', () => {
    const counts = { '@': 0, '+': 0, '-': 0 };
    let starMandatory = 0;
    let starMaximum = 0;
    for (const p of usBundledProcedures.records) {
      for (const leg of legSequences(p).flat()) {
        if (leg.speedConstraint === undefined) {
          continue;
        }
        counts[leg.speedConstraint.descriptor] += 1;
        if (p.type === 'STAR') {
          if (leg.speedConstraint.descriptor === '@') {
            starMandatory += 1;
          } else if (leg.speedConstraint.descriptor === '-') {
            starMaximum += 1;
          }
        }
      }
    }
    assert(counts['@'] > 1000, `expected many mandatory speeds, got ${counts['@']}`);
    assert(counts['-'] > 1000, `expected many maximum speeds, got ${counts['-']}`);
    assert(counts['+'] > 0, 'expected some minimum speeds');
    assert(
      starMandatory > starMaximum,
      `expected STAR speed restrictions to be mostly mandatory: @ ${starMandatory}, - ${starMaximum}`,
    );
  });

  it('gives every IAP at an airport a distinct name', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const p of usBundledProcedures.records) {
      if (p.type !== 'IAP') {
        continue;
      }
      const key = `${p.airports[0]}::${p.name}`;
      if (seen.has(key)) {
        duplicates.push(`${key} (${p.identifier})`);
      }
      seen.add(key);
    }
    expect(duplicates, `IAPs sharing a name:\n  ${duplicates.slice(0, 5).join('\n  ')}`).toEqual(
      [],
    );
  });

  it('names multiple approaches of the same type with their indicator letter', () => {
    const indicatorNames = usBundledProcedures.records.filter(
      (r) => r.type === 'IAP' && /^[A-Z_]+ [A-Z] RWY \d{2}[LRC]?$/.test(r.name),
    );
    assert(
      indicatorNames.length > 500,
      `expected many Y/Z-style names, got ${indicatorNames.length}`,
    );
    const jfk = usBundledProcedures.records.find(
      (r) => r.airports.includes('KJFK') && r.identifier === 'R027',
    );
    assert(jfk !== undefined, 'expected the course-named KJFK R027 approach');
    expect(jfk.name).toBe('RNAV 027');
    expect(jfk.runway).toBe(undefined);
  });

  it('records the runway on runway-specific SID and STAR common routes', () => {
    let populated = 0;
    for (const p of usBundledProcedures.records) {
      for (const route of p.commonRoutes) {
        if (route.runway === undefined) {
          continue;
        }
        populated += 1;
        assert(
          p.type !== 'IAP',
          `IAP common route carries a runway: ${p.airports[0]} ${p.identifier}`,
        );
        assert(/^\d{2}[LRCB]?$/.test(route.runway), `unexpected runway designator ${route.runway}`);
      }
    }
    assert(populated >= 20, `expected at least 20 runway-specific common routes, got ${populated}`);
  });

  it('carries RNP values with at most three decimals', () => {
    let checked = 0;
    for (const p of usBundledProcedures.records) {
      for (const leg of legSequences(p).flat()) {
        if (leg.rnpNm === undefined) {
          continue;
        }
        checked += 1;
        const scaled = leg.rnpNm * 1000;
        assert(
          Math.abs(scaled - Math.round(scaled)) < 1e-9,
          `RNP value carries floating-point noise: ${leg.rnpNm}`,
        );
      }
    }
    assert(checked > 1000, 'expected many RNP values');
  });

  it('carries the vertical angle on final approach legs as a descent angle', () => {
    let count = 0;
    for (const p of usBundledProcedures.records) {
      for (const leg of legSequences(p).flat()) {
        if (leg.verticalAngleDeg === undefined) {
          continue;
        }
        count += 1;
        assert(
          leg.verticalAngleDeg <= 0 && leg.verticalAngleDeg >= -10,
          `implausible vertical angle ${leg.verticalAngleDeg} on ${p.airports[0]} ${p.identifier}`,
        );
      }
    }
    assert(count > 10_000, `expected vertical angles on many approach legs, got ${count}`);
  });

  it('publishes the transition altitude on nearly every procedure', () => {
    const withAltitude = usBundledProcedures.records.filter(
      (r) => r.transitionAltitudeFt !== undefined,
    );
    assert(
      withAltitude.length / usBundledProcedures.records.length > 0.99,
      `expected a transition altitude on more than 99% of procedures, got ${withAltitude.length}`,
    );
    for (const p of withAltitude) {
      assert(
        p.transitionAltitudeFt === 18_000,
        `unexpected transition altitude ${p.transitionAltitudeFt} on ${p.airports[0]} ${p.identifier}`,
      );
    }
  });

  it('carries route type qualifiers on approach legs and names copter approaches', () => {
    const qualifier2 = new Map<string, number>();
    let qualifier1 = 0;
    let gnssFms = 0;
    for (const p of usBundledProcedures.records) {
      for (const leg of legSequences(p).flat()) {
        if (leg.routeTypeQualifier2 !== undefined) {
          qualifier2.set(
            leg.routeTypeQualifier2,
            (qualifier2.get(leg.routeTypeQualifier2) ?? 0) + 1,
          );
        }
        if (leg.routeTypeQualifier1 !== undefined) {
          qualifier1 += 1;
        }
        if (leg.gnssFmsIndication !== undefined) {
          gnssFms += 1;
        }
      }
    }
    expect([...qualifier2.keys()].sort()).toEqual(['C', 'H', 'S']);
    assert((qualifier2.get('C') ?? 0) > 1000, 'expected many circling approach legs');
    assert(qualifier1 > 100_000, 'expected route type qualifier 1 on most approach legs');
    assert(gnssFms > 100_000, 'expected the GNSS/FMS indication on most approach legs');
    const copter = usBundledProcedures.records.find(
      (r) => r.airports.includes('KLGA') && r.identifier === 'R250',
    );
    assert(copter !== undefined, 'expected the KLGA R250 copter approach');
    expect(copter.name).toBe('COPTER RNAV 250');
  });

  it('flags a mandatory turn direction only alongside a turn direction', () => {
    let count = 0;
    for (const p of usBundledProcedures.records) {
      for (const leg of legSequences(p).flat()) {
        if (leg.turnDirectionValid !== true) {
          continue;
        }
        count += 1;
        assert(
          leg.turnDirection !== undefined,
          `mandatory turn without a direction on ${p.airports[0]} ${p.identifier}`,
        );
      }
    }
    assert(count > 1000, `expected many mandatory turn directions, got ${count}`);
  });

  it('publishes rho only where it is a distance', () => {
    let checked = 0;
    for (const p of usBundledProcedures.records) {
      for (const leg of legSequences(p).flat()) {
        if (leg.rhoNm === undefined) {
          continue;
        }
        checked += 1;
        assert(
          leg.rhoNm < 999.9,
          `saturated rho published on ${p.airports[0]} ${p.identifier}: ${leg.rhoNm}`,
        );
      }
    }
    assert(checked > 20_000, `expected many rho values, got ${checked}`);
    // The St. George ILS RWY 11 missed approach names the Minot, ND VOR, about
    // 2,300 nm away. Theta and the navaid stay as published; the overflowed rho
    // does not.
    const stGeorge = usBundledProcedures.records.find(
      (r) => r.airports.includes('PAPB') && r.identifier === 'I11',
    );
    assert(stGeorge?.missedApproach !== undefined, 'expected PAPB I11 with a missed approach');
    const minotLeg = stGeorge.missedApproach.legs.find((l) => l.recommendedNavaid === 'MIB');
    assert(minotLeg !== undefined, 'expected the MIB-referenced missed approach leg');
    expect(minotLeg.rhoNm).toBe(undefined);
    expect(minotLeg.thetaDeg).toBe(300.9);
  });

  it('gives every SID and STAR a common route or a transition', () => {
    const empty = usBundledProcedures.records.filter(
      (r) => r.type !== 'IAP' && r.commonRoutes.length === 0 && r.transitions.length === 0,
    );
    expect(empty.map((r) => `${r.airports[0]} ${r.identifier}`)).toEqual([]);
  });
});

describe('coordinate precision', () => {
  it('carries at most 6 decimal places on leg positions', () => {
    let most = 0;
    for (const procedure of usBundledProcedures.records) {
      for (const legs of legSequences(procedure)) {
        for (const leg of legs) {
          if (leg.lat !== undefined && leg.lon !== undefined) {
            most = Math.max(most, decimalPlaces(leg.lat), decimalPlaces(leg.lon));
          }
        }
      }
    }
    assert(most <= 6, `found a coordinate with ${most} decimal places`);
  });
});
