import { describe, it, expect } from 'vitest';

import {
  approachTypeFromRouteType,
  circlingLetterFromApproachIdentifier,
  courseFromApproachIdentifier,
  multipleIndicatorFromApproachIdentifier,
  runwayFromApproachIdentifier,
} from './classify-approach.js';

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

  it('returns undefined for approaches named by final approach course', () => {
    // KJFK R027 is flown to course 027, not to runway 02.
    expect(runwayFromApproachIdentifier('R027')).toBe(undefined);
    expect(runwayFromApproachIdentifier('R250  ')).toBe(undefined);
  });
});

describe('multipleIndicatorFromApproachIdentifier', () => {
  it('extracts the indicator letter that follows the runway', () => {
    expect(multipleIndicatorFromApproachIdentifier('I01LZ')).toBe('Z');
    expect(multipleIndicatorFromApproachIdentifier('R19RY')).toBe('Y');
    expect(multipleIndicatorFromApproachIdentifier('H28LX')).toBe('X');
    expect(multipleIndicatorFromApproachIdentifier('H13RW')).toBe('W');
  });

  it('skips the dash filler used when the runway has no sidedness letter', () => {
    expect(multipleIndicatorFromApproachIdentifier('R21-Y')).toBe('Y');
    expect(multipleIndicatorFromApproachIdentifier('I23-Z ')).toBe('Z');
    expect(multipleIndicatorFromApproachIdentifier('R08-V')).toBe('V');
  });

  it('returns undefined when there is no indicator or no runway', () => {
    expect(multipleIndicatorFromApproachIdentifier('I04L')).toBe(undefined);
    expect(multipleIndicatorFromApproachIdentifier('R13   ')).toBe(undefined);
    expect(multipleIndicatorFromApproachIdentifier('VOR-A')).toBe(undefined);
    expect(multipleIndicatorFromApproachIdentifier('R027')).toBe(undefined);
    expect(multipleIndicatorFromApproachIdentifier('I')).toBe(undefined);
  });
});

describe('courseFromApproachIdentifier', () => {
  it('extracts a three-digit final approach course', () => {
    expect(courseFromApproachIdentifier('R027')).toBe('027');
    expect(courseFromApproachIdentifier('R250  ')).toBe('250');
  });

  it('returns undefined for runway-specific, circling and too-short identifiers', () => {
    expect(courseFromApproachIdentifier('I04L')).toBe(undefined);
    expect(courseFromApproachIdentifier('R21-Y')).toBe(undefined);
    expect(courseFromApproachIdentifier('VOR-A')).toBe(undefined);
    expect(courseFromApproachIdentifier('R')).toBe(undefined);
  });
});

describe('circlingLetterFromApproachIdentifier', () => {
  it('extracts the circling letter after the abbreviated type', () => {
    expect(circlingLetterFromApproachIdentifier('VOR-A')).toBe('A');
    expect(circlingLetterFromApproachIdentifier('RNV-B')).toBe('B');
    expect(circlingLetterFromApproachIdentifier('VDM-C')).toBe('C');
    expect(circlingLetterFromApproachIdentifier('LDA-H')).toBe('H');
    expect(circlingLetterFromApproachIdentifier('NDB-A ')).toBe('A');
  });

  it('accepts the dashless form', () => {
    expect(circlingLetterFromApproachIdentifier('RNVA')).toBe('A');
  });

  it('returns undefined for runway-specific, course-named and empty bodies', () => {
    expect(circlingLetterFromApproachIdentifier('I04L')).toBe(undefined);
    expect(circlingLetterFromApproachIdentifier('R21-Y')).toBe(undefined);
    expect(circlingLetterFromApproachIdentifier('R027')).toBe(undefined);
    expect(circlingLetterFromApproachIdentifier('V')).toBe(undefined);
  });
});
