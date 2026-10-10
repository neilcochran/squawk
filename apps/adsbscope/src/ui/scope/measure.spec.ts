import { describe, expect, it } from 'vitest';

import {
  anchorMeasurement,
  anchorOf,
  formatMeasureLabel,
  formatMeasureReadout,
  isMeasurementLive,
  MEASURE_PROMPTS,
  measureBetween,
  resolveAnchor,
  resolveMeasurement,
  startMeasurement,
} from './measure.js';
import type { MeasureAnchor, Measurement } from './measure.js';
import { makeSnapshot, makeTarget } from './test-utils.js';

const NORTH_10 = { trueBearingDeg: 0, rangeNm: 10 };
const EAST_10 = { trueBearingDeg: 90, rangeNm: 10 };
const AIRCRAFT: MeasureAnchor = { kind: 'target', icaoHex: 'aaaaaa' };
const POINT: MeasureAnchor = { kind: 'point', position: EAST_10 };
const snapshot = makeSnapshot([makeTarget({ icaoHex: 'aaaaaa', position: NORTH_10 })]);

describe('startMeasurement', () => {
  it('starts from the selected aircraft, waiting only for the far end', () => {
    expect(startMeasurement(makeTarget({ icaoHex: 'aaaaaa', position: NORTH_10 }))).toEqual({
      phase: 'awaitingSecond',
      from: AIRCRAFT,
    });
  });

  it('waits for both ends when nothing is selected, or the selected aircraft has no position', () => {
    expect(startMeasurement(undefined)).toEqual({ phase: 'awaitingFirst' });
    expect(startMeasurement(makeTarget({ icaoHex: 'aaaaaa' }))).toEqual({ phase: 'awaitingFirst' });
  });
});

describe('anchorOf', () => {
  it('anchors to the aircraft a pick landed on, and otherwise to the point', () => {
    expect(anchorOf({ icaoHex: 'aaaaaa', position: EAST_10 })).toEqual(AIRCRAFT);
    expect(anchorOf({ icaoHex: undefined, position: EAST_10 })).toEqual(POINT);
  });
});

describe('anchorMeasurement', () => {
  it('takes the first end, then the second, then changes nothing', () => {
    const first = anchorMeasurement({ phase: 'awaitingFirst' }, AIRCRAFT);
    const second = anchorMeasurement(first, POINT);

    expect(first).toEqual({ phase: 'awaitingSecond', from: AIRCRAFT });
    expect(second).toEqual({ phase: 'complete', from: AIRCRAFT, to: POINT });
    expect(anchorMeasurement(second, AIRCRAFT)).toBe(second);
  });
});

describe('resolveAnchor', () => {
  it('follows an aircraft through each snapshot, and leaves a point where it is', () => {
    const moved = makeSnapshot([makeTarget({ icaoHex: 'aaaaaa', position: EAST_10 })]);

    expect(resolveAnchor(AIRCRAFT, snapshot)).toEqual(NORTH_10);
    expect(resolveAnchor(AIRCRAFT, moved)).toEqual(EAST_10);
    expect(resolveAnchor(POINT, moved)).toEqual(EAST_10);
  });

  it('has no position for an aircraft that is not tracked, has none, or before any snapshot', () => {
    expect(resolveAnchor(AIRCRAFT, makeSnapshot())).toBeUndefined();
    expect(
      resolveAnchor(AIRCRAFT, makeSnapshot([makeTarget({ icaoHex: 'aaaaaa' })])),
    ).toBeUndefined();
    expect(resolveAnchor(AIRCRAFT, undefined)).toBeUndefined();
    expect(resolveAnchor(POINT, undefined)).toEqual(EAST_10);
  });
});

describe('isMeasurementLive', () => {
  const complete: Measurement = { phase: 'complete', from: AIRCRAFT, to: POINT };

  it('is live while every aircraft it is anchored to is still plotted', () => {
    expect(isMeasurementLive(complete, snapshot)).toBe(true);
    expect(isMeasurementLive({ phase: 'awaitingSecond', from: AIRCRAFT }, snapshot)).toBe(true);
  });

  it('is not live once an anchored aircraft has gone, or lost its position', () => {
    expect(isMeasurementLive(complete, makeSnapshot())).toBe(false);
    expect(isMeasurementLive(complete, makeSnapshot([makeTarget({ icaoHex: 'aaaaaa' })]))).toBe(
      false,
    );
  });

  it('is live before the first snapshot, and with only fixed points', () => {
    expect(isMeasurementLive(complete, undefined)).toBe(true);
    expect(isMeasurementLive({ phase: 'awaitingFirst' }, makeSnapshot())).toBe(true);
    expect(isMeasurementLive({ phase: 'complete', from: POINT, to: POINT }, makeSnapshot())).toBe(
      true,
    );
  });
});

describe('measureBetween', () => {
  it('measures across the scope, not from the receiver', () => {
    const measured = measureBetween(NORTH_10, EAST_10);

    expect(measured.trueBearingDeg).toBeCloseTo(135);
    expect(measured.distanceNm).toBeCloseTo(10 * Math.SQRT2);
  });

  it('reads the reverse direction as the reciprocal bearing, never a negative one', () => {
    expect(measureBetween(EAST_10, NORTH_10).trueBearingDeg).toBeCloseTo(315);
  });

  it('measures along a radial as the difference in range', () => {
    const measured = measureBetween(NORTH_10, { trueBearingDeg: 0, rangeNm: 25 });

    expect(measured.trueBearingDeg).toBeCloseTo(0);
    expect(measured.distanceNm).toBeCloseTo(15);
  });

  it('measures nothing between a point and itself', () => {
    expect(measureBetween(EAST_10, EAST_10).distanceNm).toBe(0);
  });
});

describe('resolveMeasurement', () => {
  it('runs a complete line between its ends, wherever the aircraft is now', () => {
    const line = resolveMeasurement(
      { phase: 'complete', from: AIRCRAFT, to: POINT },
      snapshot,
      undefined,
    );

    expect(line?.from).toEqual(NORTH_10);
    expect(line?.to).toEqual(EAST_10);
    expect(line?.trueBearingDeg).toBeCloseTo(135);
    expect(line?.distanceNm).toBeCloseTo(10 * Math.SQRT2);
  });

  it('runs a half-drawn line from its first end to the pointer, and nowhere without one', () => {
    const halfDrawn: Measurement = { phase: 'awaitingSecond', from: AIRCRAFT };

    expect(resolveMeasurement(halfDrawn, snapshot, EAST_10)?.to).toEqual(EAST_10);
    expect(resolveMeasurement(halfDrawn, snapshot, undefined)).toBeUndefined();
  });

  it('has nothing to draw with no measurement, before the first end, or while an end cannot be placed', () => {
    expect(resolveMeasurement(undefined, snapshot, EAST_10)).toBeUndefined();
    expect(resolveMeasurement({ phase: 'awaitingFirst' }, snapshot, EAST_10)).toBeUndefined();
    expect(
      resolveMeasurement(
        { phase: 'complete', from: AIRCRAFT, to: POINT },
        makeSnapshot(),
        undefined,
      ),
    ).toBeUndefined();
  });
});

describe('formatMeasureLabel', () => {
  it('writes bearing and distance compactly', () => {
    expect(
      formatMeasureLabel({ from: NORTH_10, to: EAST_10, trueBearingDeg: 47.4, distanceNm: 12.34 }),
    ).toBe('047/12.3');
  });
});

describe('formatMeasureReadout', () => {
  const line = { from: NORTH_10, to: EAST_10, trueBearingDeg: 47.4, distanceNm: 12.34 };

  it('reads what the line measures once there is one', () => {
    expect(formatMeasureReadout({ phase: 'awaitingSecond', from: AIRCRAFT }, line)).toBe(
      'measure 047 true, 12.3 nm',
    );
    expect(formatMeasureReadout({ phase: 'complete', from: AIRCRAFT, to: POINT }, line)).toBe(
      'measure 047 true, 12.3 nm',
    );
  });

  it('prompts for the end it is waiting for until then', () => {
    expect(formatMeasureReadout({ phase: 'awaitingFirst' }, undefined)).toBe(
      MEASURE_PROMPTS.awaitingFirst,
    );
    expect(formatMeasureReadout({ phase: 'awaitingSecond', from: AIRCRAFT }, undefined)).toBe(
      MEASURE_PROMPTS.awaitingSecond,
    );
  });

  it('says nothing without a measurement', () => {
    expect(formatMeasureReadout(undefined, undefined)).toBeUndefined();
    expect(formatMeasureReadout(undefined, line)).toBeUndefined();
  });
});
