import { describe, it, expect } from 'vitest';

import { approachTypeFromRouteType, runwayFromApproachIdentifier } from './classify-approach.js';

describe('approachTypeFromRouteType', () => {
  it('maps every recognized route-type letter to an ApproachType', () => {
    const cases: Array<[string, string]> = [
      ['I', 'ILS'],
      ['L', 'LOC'],
      ['B', 'LOC_BC'],
      ['R', 'RNAV'],
      ['H', 'RNAV_RNP'],
      ['V', 'VOR'],
      ['D', 'VOR_DME'],
      ['S', 'VOR'],
      ['N', 'NDB'],
      ['Q', 'NDB_DME'],
      ['T', 'TACAN'],
      ['J', 'GLS'],
      ['G', 'IGS'],
      ['X', 'LDA'],
      ['U', 'SDF'],
      ['P', 'GPS'],
      ['F', 'FMS'],
      ['M', 'MLS'],
      ['W', 'MLS'],
      ['Y', 'MLS'],
    ];
    for (const [letter, expected] of cases) {
      expect(
        approachTypeFromRouteType(letter),
        `expected route type ${letter} to map to ${expected}`,
      ).toBe(expected);
    }
  });

  it('returns undefined for transition and missed-approach route types', () => {
    expect(approachTypeFromRouteType('A')).toBe(undefined);
    expect(approachTypeFromRouteType('Z')).toBe(undefined);
  });

  it('returns undefined for unknown letters', () => {
    expect(approachTypeFromRouteType('K')).toBe(undefined);
    expect(approachTypeFromRouteType('O')).toBe(undefined);
  });

  it('returns undefined for multi-character input', () => {
    expect(approachTypeFromRouteType('')).toBe(undefined);
    expect(approachTypeFromRouteType('IL')).toBe(undefined);
  });
});

describe('runwayFromApproachIdentifier', () => {
  it('extracts a runway with a sidedness suffix', () => {
    expect(runwayFromApproachIdentifier('I04L')).toBe('04L');
    expect(runwayFromApproachIdentifier('R27R')).toBe('27R');
    expect(runwayFromApproachIdentifier('L13C')).toBe('13C');
  });

  it('extracts a runway without a sidedness suffix', () => {
    expect(runwayFromApproachIdentifier('I13')).toBe('13');
    expect(runwayFromApproachIdentifier('R09')).toBe('09');
  });

  it('trims trailing padding spaces from the identifier', () => {
    expect(runwayFromApproachIdentifier('I04L  ')).toBe('04L');
    expect(runwayFromApproachIdentifier('R13   ')).toBe('13');
  });

  it('extracts the runway portion when a variant suffix follows', () => {
    expect(runwayFromApproachIdentifier('I04LY')).toBe('04L');
    expect(runwayFromApproachIdentifier('R27RZ')).toBe('27R');
    expect(runwayFromApproachIdentifier('L13CW')).toBe('13C');
  });

  it('returns undefined for circling approaches (no runway-specific identifier)', () => {
    expect(runwayFromApproachIdentifier('VOR-A')).toBe(undefined);
    expect(runwayFromApproachIdentifier('RNV-B')).toBe(undefined);
    expect(runwayFromApproachIdentifier('GPS-C')).toBe(undefined);
    expect(runwayFromApproachIdentifier('LDA-D')).toBe(undefined);
    expect(runwayFromApproachIdentifier('NDB-A')).toBe(undefined);
  });

  it('returns undefined for too-short identifiers', () => {
    expect(runwayFromApproachIdentifier('')).toBe(undefined);
    expect(runwayFromApproachIdentifier('I')).toBe(undefined);
  });

  it('extracts runway when the variant is prefixed with dash-letter', () => {
    // Variant-Y / Variant-Z syntax: "R01-Y" means runway 01, variant Y
    expect(runwayFromApproachIdentifier('R01-Y')).toBe('01');
    expect(runwayFromApproachIdentifier('I27-Z')).toBe('27');
  });
});
