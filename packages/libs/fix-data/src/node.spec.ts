import { describe, it, expect, assert } from 'vitest';

import { usBundledFixes } from './node.js';

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

describe('usBundledFixes', () => {
  it('loads with a reasonable number of records', () => {
    assert(usBundledFixes.records.length > 50_000);
  });

  it('has metadata with generatedAt, nasrCycleDate, and recordCount', () => {
    assert(usBundledFixes.properties.generatedAt.length > 0);
    assert(usBundledFixes.properties.nasrCycleDate.length > 0);
    expect(usBundledFixes.properties.recordCount).toBe(usBundledFixes.records.length);
  });

  it('contains records with the expected required fields', () => {
    const first = usBundledFixes.records[0];
    assert(first !== undefined);
    expect(typeof first.identifier).toBe('string');
    assert(first.identifier.length > 0);
    expect(typeof first.icaoRegionCode).toBe('string');
    expect(typeof first.country).toBe('string');
    expect(typeof first.lat).toBe('number');
    expect(typeof first.lon).toBe('number');
    expect(typeof first.useCode).toBe('string');
    expect(typeof first.pitch).toBe('boolean');
    expect(typeof first.catch).toBe('boolean');
    expect(typeof first.suaAtcaa).toBe('boolean');
    assert(Array.isArray(first.chartTypes));
    assert(Array.isArray(first.navaidAssociations));
  });

  it('populates state for US fixes', () => {
    const us = usBundledFixes.records.find((r) => r.country === 'US');
    assert(us !== undefined);
    expect(typeof us.state).toBe('string');
    assert(us.state && us.state.length > 0);
  });

  it('includes foreign fixes that the FAA publishes (e.g. Canadian fixes)', () => {
    const foreign = usBundledFixes.records.filter((r) => r.country !== 'US');
    assert(foreign.length > 0, 'expected at least one foreign fix');

    const canadian = usBundledFixes.records.find((r) => r.country === 'CA');
    assert(canadian !== undefined, 'expected at least one Canadian fix');
    expect(canadian.state, 'non-US fixes should have no state').toBe(undefined);
    expect(canadian.icaoRegionCode.startsWith('CY')).toBe(true);
  });

  it('does not contain CNF (computer navigation fix) records', () => {
    const cnf = usBundledFixes.records.find((r) => r.useCode === 'CN');
    expect(cnf, 'CNF records should be excluded').toBe(undefined);
  });

  it('contains records with various use codes', () => {
    const useCodes = new Set(usBundledFixes.records.map((r) => r.useCode));
    assert(useCodes.has('WP'), 'expected WP use code');
    assert(useCodes.has('RP'), 'expected RP use code');
  });

  it('contains records with optional fields populated', () => {
    const withArtcc = usBundledFixes.records.find((r) => r.highArtccId !== undefined);
    assert(withArtcc !== undefined, 'expected at least one fix with highArtccId');

    const withCompulsory = usBundledFixes.records.find((r) => r.compulsory !== undefined);
    assert(withCompulsory !== undefined, 'expected at least one compulsory fix');

    const withCharts = usBundledFixes.records.find((r) => r.chartTypes.length > 0);
    assert(withCharts !== undefined, 'expected at least one fix with chart types');
  });

  it('carries every navaid association the FAA publishes', () => {
    const associations = usBundledFixes.records.flatMap((r) => r.navaidAssociations);
    assert(
      associations.length >= 25_000,
      `expected at least 25,000 associations, found ${associations.length}`,
    );
    for (const association of associations) {
      assert(association.navaidId.length > 0, 'association without a facility identifier');
      assert(association.navaidType.length > 0, 'association without a facility type');
    }
  });

  it('keeps associations that publish only a bearing, only a distance, or neither', () => {
    const associations = usBundledFixes.records.flatMap((r) => r.navaidAssociations);
    const both = associations.filter(
      (a) => a.magneticBearingDeg !== undefined && a.distanceNm !== undefined,
    );
    const bearingOnly = associations.filter(
      (a) => a.magneticBearingDeg !== undefined && a.distanceNm === undefined,
    );
    const distanceOnly = associations.filter(
      (a) => a.magneticBearingDeg === undefined && a.distanceNm !== undefined,
    );
    const neither = associations.filter(
      (a) => a.magneticBearingDeg === undefined && a.distanceNm === undefined,
    );
    assert(both.length > 15_000, `bearing and distance: ${both.length}`);
    assert(bearingOnly.length > 5_000, `bearing only: ${bearingOnly.length}`);
    assert(distanceOnly.length > 500, `distance only: ${distanceOnly.length}`);
    assert(neither.length > 100, `neither: ${neither.length}`);
  });

  it('publishes bearings from 0 to 360 and distances that are not negative', () => {
    for (const fix of usBundledFixes.records) {
      for (const association of fix.navaidAssociations) {
        const label = `${fix.identifier} from ${association.navaidId}`;
        if (association.magneticBearingDeg !== undefined) {
          assert(
            association.magneticBearingDeg >= 0 && association.magneticBearingDeg <= 360,
            `${label}: bearing ${association.magneticBearingDeg}`,
          );
        }
        if (association.distanceNm !== undefined) {
          assert(
            association.distanceNm >= 0 && association.distanceNm < 300,
            `${label}: distance ${association.distanceNm}`,
          );
        }
      }
    }
  });

  it('keeps the definition of a fix whose associations all lack a bearing or a distance', () => {
    const acore = usBundledFixes.records.find((r) => r.identifier === 'ACORE');
    assert(acore !== undefined, 'expected to find ACORE fix');
    const localizer = acore.navaidAssociations.find((a) => a.navaidType === 'LOC');
    assert(localizer !== undefined, 'expected ACORE to keep its localizer association');
    expect(typeof localizer.magneticBearingDeg).toBe('number');
    expect(localizer.distanceNm).toBe(undefined);
    const marker = acore.navaidAssociations.find((a) => a.navaidType === 'OM');
    assert(marker !== undefined, 'expected ACORE to keep its outer marker association');
    expect(marker.magneticBearingDeg).toBe(undefined);
    expect(marker.distanceNm).toBe(undefined);
  });

  it('includes the fixes at the pole, on the antimeridian and on the equator', () => {
    for (const fix of usBundledFixes.records) {
      assert(fix.lat >= -90 && fix.lat <= 90, `${fix.identifier}: lat ${fix.lat}`);
      assert(fix.lon >= -180 && fix.lon <= 180, `${fix.identifier}: lon ${fix.lon}`);
    }
    const pole = usBundledFixes.records.find((r) => r.identifier === 'NOPOL');
    assert(pole !== undefined, 'expected to find NOPOL fix');
    expect(pole.lat).toBe(90);
    assert(
      usBundledFixes.records.some((r) => Math.abs(r.lon) === 180),
      'expected a fix on the antimeridian',
    );
    assert(
      usBundledFixes.records.some((r) => r.lat === 0),
      'expected a fix on the equator',
    );
  });

  it('can find a known fix by scanning records', () => {
    const merit = usBundledFixes.records.find((r) => r.identifier === 'MERIT');
    assert(merit !== undefined, 'expected to find MERIT fix');
    expect(merit.country).toBe('US');
  });
});

describe('coordinate precision', () => {
  it('carries at most 8 decimal places on fix positions', () => {
    let most = 0;
    for (const fix of usBundledFixes.records) {
      most = Math.max(most, decimalPlaces(fix.lat), decimalPlaces(fix.lon));
    }
    assert(most <= 8, `found a coordinate with ${most} decimal places`);
  });
});
