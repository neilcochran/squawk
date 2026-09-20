import { describe, expect, it } from 'vitest';

import { isWithinExtent } from './extent.js';
import { createViewport, polarToScreen } from './projection.js';
import { findSelectedTarget, PICK_RADIUS_REM, pickTarget, stepSelection } from './selection.js';
import { makeSnapshot, makeTarget } from './test-utils.js';
import { DEFAULT_PX_PER_REM } from './units.js';

const VIEWPORT = createViewport(800, 600, 60, DEFAULT_PX_PER_REM);
const NEAR = { trueBearingDeg: 90, rangeNm: 20 };
const BEYOND = { trueBearingDeg: 90, rangeNm: 70 };

describe('isWithinExtent', () => {
  it('rules nothing out of a scope that fills the canvas', () => {
    expect(isWithinExtent(VIEWPORT, NEAR, 'canvas')).toBe(true);
    expect(isWithinExtent(VIEWPORT, BEYOND, 'canvas')).toBe(true);
  });

  it('rules out what lies beyond the range circle of a round scope, but not what lies on it', () => {
    expect(isWithinExtent(VIEWPORT, NEAR, 'rangeCircle')).toBe(true);
    expect(isWithinExtent(VIEWPORT, { trueBearingDeg: 0, rangeNm: 60 }, 'rangeCircle')).toBe(true);
    expect(isWithinExtent(VIEWPORT, BEYOND, 'rangeCircle')).toBe(false);
  });
});

describe('pickTarget', () => {
  const near = makeTarget({ icaoHex: 'aaaaaa', position: NEAR });
  const at = polarToScreen(VIEWPORT, NEAR);

  it('picks the aircraft under the point, and nothing from empty scope', () => {
    const snapshot = makeSnapshot([near]);

    expect(pickTarget(VIEWPORT, snapshot, at, 'canvas')).toBe('aaaaaa');
    expect(pickTarget(VIEWPORT, snapshot, { xPx: 10, yPx: 10 }, 'canvas')).toBeUndefined();
    expect(pickTarget(VIEWPORT, undefined, at, 'canvas')).toBeUndefined();
  });

  it('allows a fingertip of slack around the aircraft, and no more', () => {
    const snapshot = makeSnapshot([near]);
    const radiusPx = PICK_RADIUS_REM * DEFAULT_PX_PER_REM;

    expect(pickTarget(VIEWPORT, snapshot, { xPx: at.xPx + radiusPx, yPx: at.yPx }, 'canvas')).toBe(
      'aaaaaa',
    );
    expect(
      pickTarget(VIEWPORT, snapshot, { xPx: at.xPx + radiusPx + 1, yPx: at.yPx }, 'canvas'),
    ).toBeUndefined();
  });

  it('picks the nearer of two aircraft within reach', () => {
    const other = makeTarget({ icaoHex: 'bbbbbb', position: { trueBearingDeg: 90, rangeNm: 22 } });
    const otherAt = polarToScreen(VIEWPORT, { trueBearingDeg: 90, rangeNm: 22 });
    const snapshot = makeSnapshot([near, other]);

    expect(pickTarget(VIEWPORT, snapshot, { xPx: at.xPx + 1, yPx: at.yPx }, 'canvas')).toBe(
      'aaaaaa',
    );
    expect(
      pickTarget(VIEWPORT, snapshot, { xPx: otherAt.xPx - 1, yPx: otherAt.yPx }, 'canvas'),
    ).toBe('bbbbbb');
  });

  it('never picks an aircraft with no position', () => {
    const snapshot = makeSnapshot([makeTarget({ icaoHex: 'cccccc' })]);

    expect(pickTarget(VIEWPORT, snapshot, VIEWPORT.center, 'canvas')).toBeUndefined();
  });

  it('picks an aircraft beyond the range circle only from a scope that draws it there', () => {
    const snapshot = makeSnapshot([makeTarget({ icaoHex: 'dddddd', position: BEYOND })]);
    const beyondAt = polarToScreen(VIEWPORT, BEYOND);

    expect(pickTarget(VIEWPORT, snapshot, beyondAt, 'canvas')).toBe('dddddd');
    expect(pickTarget(VIEWPORT, snapshot, beyondAt, 'rangeCircle')).toBeUndefined();
  });
});

describe('findSelectedTarget', () => {
  const target = makeTarget({ icaoHex: 'aaaaaa' });

  it('finds the selected aircraft in the snapshot', () => {
    expect(findSelectedTarget(makeSnapshot([target]), 'aaaaaa')).toBe(target);
  });

  it('finds nothing when nothing is selected, or the aircraft is no longer tracked', () => {
    expect(findSelectedTarget(makeSnapshot([target]), undefined)).toBeUndefined();
    expect(findSelectedTarget(makeSnapshot([target]), 'bbbbbb')).toBeUndefined();
    expect(findSelectedTarget(undefined, 'aaaaaa')).toBeUndefined();
  });
});

describe('stepSelection', () => {
  const snapshot = makeSnapshot([
    makeTarget({ icaoHex: 'cccccc', callsign: 'UAL9' }),
    makeTarget({ icaoHex: 'aaaaaa', callsign: 'AAL7' }),
    makeTarget({ icaoHex: 'bbbbbb', callsign: 'DAL45' }),
  ]);

  it('starts from the first aircraft going forwards, and the last going backwards', () => {
    expect(stepSelection(snapshot, undefined, 'next')).toBe('aaaaaa');
    expect(stepSelection(snapshot, undefined, 'previous')).toBe('cccccc');
  });

  it('moves through the aircraft in order of identity, wrapping at either end', () => {
    expect(stepSelection(snapshot, 'aaaaaa', 'next')).toBe('bbbbbb');
    expect(stepSelection(snapshot, 'cccccc', 'next')).toBe('aaaaaa');
    expect(stepSelection(snapshot, 'bbbbbb', 'previous')).toBe('aaaaaa');
    expect(stepSelection(snapshot, 'aaaaaa', 'previous')).toBe('cccccc');
  });

  it('starts over when the selected aircraft is no longer tracked', () => {
    expect(stepSelection(snapshot, 'ffffff', 'next')).toBe('aaaaaa');
  });

  it('orders aircraft that share an identity by their ICAO hex', () => {
    const twins = makeSnapshot([
      makeTarget({ icaoHex: 'bbbbbb', callsign: 'SAME' }),
      makeTarget({ icaoHex: 'aaaaaa', callsign: 'SAME' }),
    ]);

    expect(stepSelection(twins, undefined, 'next')).toBe('aaaaaa');
  });

  it('selects nothing when nothing is tracked', () => {
    expect(stepSelection(makeSnapshot(), undefined, 'next')).toBeUndefined();
    expect(stepSelection(undefined, 'aaaaaa', 'previous')).toBeUndefined();
  });
});
