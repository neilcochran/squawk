import { describe, expect, it } from 'vitest';

import { canStepRange, RANGE_STEPS_NM, ringRadiiNm, ringSpacingNm, stepRange } from './range.js';

describe('ringSpacingNm', () => {
  it('picks the finest round spacing that draws at most six rings', () => {
    expect(ringSpacingNm(5)).toBe(1);
    expect(ringSpacingNm(10)).toBe(2);
    expect(ringSpacingNm(20)).toBe(5);
    expect(ringSpacingNm(60)).toBe(10);
    expect(ringSpacingNm(100)).toBe(20);
    expect(ringSpacingNm(150)).toBe(25);
    expect(ringSpacingNm(250)).toBe(50);
  });

  it('never draws more than six rings at any selectable range', () => {
    for (const range of RANGE_STEPS_NM) {
      expect(range / ringSpacingNm(range)).toBeLessThanOrEqual(6);
    }
  });

  it('divides the range evenly when it is beyond every round spacing', () => {
    expect(ringSpacingNm(1200)).toBe(200);
  });
});

describe('ringRadiiNm', () => {
  it('lists rings from the innermost out to the scope range', () => {
    expect(ringRadiiNm(60)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(ringRadiiNm(5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('stops at the last ring inside a range that is not a multiple of the spacing', () => {
    expect(ringRadiiNm(25)).toEqual([5, 10, 15, 20, 25]);
    expect(ringRadiiNm(45)).toEqual([10, 20, 30, 40]);
  });
});

describe('canStepRange', () => {
  it('is true in both directions from a middle step', () => {
    expect(canStepRange(60, 'in')).toBe(true);
    expect(canStepRange(60, 'out')).toBe(true);
  });

  it('is false at the end of the steps in that direction only', () => {
    expect(canStepRange(5, 'in')).toBe(false);
    expect(canStepRange(5, 'out')).toBe(true);
    expect(canStepRange(250, 'out')).toBe(false);
    expect(canStepRange(250, 'in')).toBe(true);
  });
});

describe('stepRange', () => {
  it('steps in and out through the range steps', () => {
    expect(stepRange(60, 'in')).toBe(40);
    expect(stepRange(60, 'out')).toBe(80);
  });

  it('stays put at either end', () => {
    expect(stepRange(5, 'in')).toBe(5);
    expect(stepRange(250, 'out')).toBe(250);
  });

  it('moves a range that is not a step to the nearest step in that direction', () => {
    expect(stepRange(25, 'in')).toBe(20);
    expect(stepRange(25, 'out')).toBe(40);
    expect(stepRange(400, 'in')).toBe(250);
    expect(stepRange(400, 'out')).toBe(400);
  });
});
