import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
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
      assert.equal(
        approachTypeFromRouteType(letter),
        expected,
        `expected route type ${letter} to map to ${expected}`,
      );
    }
  });

  it('returns undefined for transition and missed-approach route types', () => {
    assert.equal(approachTypeFromRouteType('A'), undefined);
    assert.equal(approachTypeFromRouteType('Z'), undefined);
  });

  it('returns undefined for unknown letters', () => {
    assert.equal(approachTypeFromRouteType('K'), undefined);
    assert.equal(approachTypeFromRouteType('O'), undefined);
  });

  it('returns undefined for multi-character input', () => {
    assert.equal(approachTypeFromRouteType(''), undefined);
    assert.equal(approachTypeFromRouteType('IL'), undefined);
  });
});

describe('runwayFromApproachIdentifier', () => {
  it('extracts a runway with a sidedness suffix', () => {
    assert.equal(runwayFromApproachIdentifier('I04L'), '04L');
    assert.equal(runwayFromApproachIdentifier('R27R'), '27R');
    assert.equal(runwayFromApproachIdentifier('L13C'), '13C');
  });

  it('extracts a runway without a sidedness suffix', () => {
    assert.equal(runwayFromApproachIdentifier('I13'), '13');
    assert.equal(runwayFromApproachIdentifier('R09'), '09');
  });

  it('trims trailing padding spaces from the identifier', () => {
    assert.equal(runwayFromApproachIdentifier('I04L  '), '04L');
    assert.equal(runwayFromApproachIdentifier('R13   '), '13');
  });

  it('extracts the runway portion when a variant suffix follows', () => {
    assert.equal(runwayFromApproachIdentifier('I04LY'), '04L');
    assert.equal(runwayFromApproachIdentifier('R27RZ'), '27R');
    assert.equal(runwayFromApproachIdentifier('L13CW'), '13C');
  });

  it('returns undefined for circling approaches (no runway-specific identifier)', () => {
    assert.equal(runwayFromApproachIdentifier('VOR-A'), undefined);
    assert.equal(runwayFromApproachIdentifier('RNV-B'), undefined);
    assert.equal(runwayFromApproachIdentifier('GPS-C'), undefined);
    assert.equal(runwayFromApproachIdentifier('LDA-D'), undefined);
    assert.equal(runwayFromApproachIdentifier('NDB-A'), undefined);
  });

  it('returns undefined for too-short identifiers', () => {
    assert.equal(runwayFromApproachIdentifier(''), undefined);
    assert.equal(runwayFromApproachIdentifier('I'), undefined);
  });

  it('extracts runway when the variant is prefixed with dash-letter', () => {
    // Variant-Y / Variant-Z syntax: "R01-Y" means runway 01, variant Y
    assert.equal(runwayFromApproachIdentifier('R01-Y'), '01');
    assert.equal(runwayFromApproachIdentifier('I27-Z'), '27');
  });
});
