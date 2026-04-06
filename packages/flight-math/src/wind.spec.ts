import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { close } from './test-utils.js';
import { wind } from './index.js';

describe('solveWindTriangle', () => {
  it('returns zero WCA and full groundspeed with no wind', () => {
    const result = wind.solveWindTriangle(150, 360, 0, 0);
    assert.ok(
      close(result.windCorrectionAngleDeg, 0, 0.01),
      `expected WCA ~0, got ${result.windCorrectionAngleDeg}`,
    );
    assert.ok(
      close(result.groundspeedKt, 150, 0.1),
      `expected GS ~150, got ${result.groundspeedKt}`,
    );
    assert.ok(
      close(result.trueHeadingDeg, 360 % 360, 0.01) || close(result.trueHeadingDeg, 360, 0.01),
      `expected heading ~360/0, got ${result.trueHeadingDeg}`,
    );
  });

  it('computes positive WCA for wind from the right', () => {
    // Course 360 (north), wind from 90 (east) at 30 kt, TAS 150.
    const result = wind.solveWindTriangle(150, 360, 90, 30);
    assert.ok(
      result.windCorrectionAngleDeg > 0,
      `expected positive WCA, got ${result.windCorrectionAngleDeg}`,
    );
    assert.ok(
      result.trueHeadingDeg > 0 && result.trueHeadingDeg < 90,
      `expected heading NE quadrant, got ${result.trueHeadingDeg}`,
    );
  });

  it('computes negative WCA for wind from the left', () => {
    // Course 360 (north), wind from 270 (west) at 30 kt.
    const result = wind.solveWindTriangle(150, 360, 270, 30);
    assert.ok(
      result.windCorrectionAngleDeg < 0,
      `expected negative WCA, got ${result.windCorrectionAngleDeg}`,
    );
  });

  it('reduces groundspeed with a direct headwind', () => {
    // Course 360, wind from 360 (direct headwind) at 20 kt, TAS 120.
    const result = wind.solveWindTriangle(120, 360, 360, 20);
    assert.ok(close(result.groundspeedKt, 100, 1), `expected GS ~100, got ${result.groundspeedKt}`);
    assert.ok(
      close(result.windCorrectionAngleDeg, 0, 0.5),
      `expected WCA ~0, got ${result.windCorrectionAngleDeg}`,
    );
  });

  it('increases groundspeed with a direct tailwind', () => {
    // Course 360, wind from 180 (direct tailwind) at 20 kt, TAS 120.
    const result = wind.solveWindTriangle(120, 360, 180, 20);
    assert.ok(close(result.groundspeedKt, 140, 1), `expected GS ~140, got ${result.groundspeedKt}`);
  });

  it('handles wind stronger than TAS by clamping WCA', () => {
    // Wind exceeds TAS: aircraft cannot maintain course.
    const result = wind.solveWindTriangle(50, 360, 90, 80);
    assert.ok(typeof result.groundspeedKt === 'number', 'should return a numeric groundspeed');
    assert.ok(typeof result.windCorrectionAngleDeg === 'number', 'should return a numeric WCA');
  });
});

describe('headwindCrosswind', () => {
  it('returns full headwind for a direct headwind', () => {
    // Wind from 360, heading 360: direct headwind.
    const result = wind.headwindCrosswind(360, 20, 360);
    assert.ok(close(result.headwindKt, 20, 0.1), `expected headwind ~20, got ${result.headwindKt}`);
    assert.ok(
      close(result.crosswindKt, 0, 0.1),
      `expected crosswind ~0, got ${result.crosswindKt}`,
    );
  });

  it('returns full tailwind for a direct tailwind', () => {
    // Wind from 180, heading 360: direct tailwind.
    const result = wind.headwindCrosswind(180, 20, 360);
    assert.ok(
      close(result.headwindKt, -20, 0.1),
      `expected tailwind ~-20, got ${result.headwindKt}`,
    );
    assert.ok(
      close(result.crosswindKt, 0, 0.1),
      `expected crosswind ~0, got ${result.crosswindKt}`,
    );
  });

  it('returns positive crosswind from the right', () => {
    // Wind from 90, heading 360: full crosswind from the right.
    const result = wind.headwindCrosswind(90, 15, 360);
    assert.ok(close(result.headwindKt, 0, 0.1), `expected headwind ~0, got ${result.headwindKt}`);
    assert.ok(
      close(result.crosswindKt, 15, 0.1),
      `expected crosswind ~15, got ${result.crosswindKt}`,
    );
  });

  it('returns negative crosswind from the left', () => {
    // Wind from 270, heading 360: full crosswind from the left.
    const result = wind.headwindCrosswind(270, 15, 360);
    assert.ok(close(result.headwindKt, 0, 0.1), `expected headwind ~0, got ${result.headwindKt}`);
    assert.ok(
      close(result.crosswindKt, -15, 0.1),
      `expected crosswind ~-15, got ${result.crosswindKt}`,
    );
  });

  it('resolves a quartering headwind correctly', () => {
    // Wind from 030, heading 360, speed 20 kt.
    // Headwind = 20 * cos(30) = 17.32, crosswind = 20 * sin(30) = 10 (from right).
    const result = wind.headwindCrosswind(30, 20, 360);
    assert.ok(
      close(result.headwindKt, 17.32, 0.1),
      `expected headwind ~17.32, got ${result.headwindKt}`,
    );
    assert.ok(
      close(result.crosswindKt, 10, 0.1),
      `expected crosswind ~10, got ${result.crosswindKt}`,
    );
  });
});

describe('findWind', () => {
  it('returns zero wind when ground track matches air vector', () => {
    // GS = TAS, heading = track: no wind.
    const result = wind.findWind(150, 150, 360, 360);
    assert.ok(close(result.speedKt, 0, 0.1), `expected wind speed ~0, got ${result.speedKt}`);
  });

  it('detects a headwind when GS is less than TAS on the same heading', () => {
    // Heading 360, track 360, TAS 150, GS 130: 20 kt headwind from 360.
    const result = wind.findWind(130, 150, 360, 360);
    assert.ok(close(result.speedKt, 20, 0.5), `expected wind speed ~20, got ${result.speedKt}`);
    assert.ok(
      close(result.directionDeg, 360, 1) || close(result.directionDeg, 0, 1),
      `expected wind from ~360/0, got ${result.directionDeg}`,
    );
  });

  it('detects a tailwind when GS exceeds TAS on the same heading', () => {
    // Heading 360, track 360, TAS 150, GS 170: 20 kt tailwind from 180.
    const result = wind.findWind(170, 150, 360, 360);
    assert.ok(close(result.speedKt, 20, 0.5), `expected wind speed ~20, got ${result.speedKt}`);
    assert.ok(
      close(result.directionDeg, 180, 1),
      `expected wind from ~180, got ${result.directionDeg}`,
    );
  });

  it('round-trips with solveWindTriangle', () => {
    // Start with known wind, solve forward, then reverse to recover the wind.
    const knownWind = { directionDeg: 240, speedKt: 25 };
    const forward = wind.solveWindTriangle(180, 90, knownWind.directionDeg, knownWind.speedKt);
    const recovered = wind.findWind(forward.groundspeedKt, 180, forward.trueHeadingDeg, 90);
    assert.ok(
      close(recovered.speedKt, knownWind.speedKt, 0.5),
      `expected speed ~${knownWind.speedKt}, got ${recovered.speedKt}`,
    );
    assert.ok(
      close(recovered.directionDeg, knownWind.directionDeg, 1),
      `expected direction ~${knownWind.directionDeg}, got ${recovered.directionDeg}`,
    );
  });
});

describe('crosswindComponent', () => {
  it('returns zero for a direct headwind', () => {
    const xw = wind.crosswindComponent(360, 20, 360);
    assert.ok(close(xw, 0, 0.1), `expected ~0, got ${xw}`);
  });

  it('returns full wind speed for a 90-degree crosswind', () => {
    const xw = wind.crosswindComponent(90, 20, 360);
    assert.ok(close(xw, 20, 0.1), `expected ~20, got ${xw}`);
  });

  it('returns the absolute value regardless of side', () => {
    const xwRight = wind.crosswindComponent(90, 15, 360);
    const xwLeft = wind.crosswindComponent(270, 15, 360);
    assert.ok(close(xwRight, xwLeft, 0.01), `expected same magnitude, got ${xwRight} vs ${xwLeft}`);
  });

  it('resolves a quartering wind correctly', () => {
    // Wind from 030, runway 360, 20 kt: crosswind = 20 * sin(30) = 10.
    const xw = wind.crosswindComponent(30, 20, 360);
    assert.ok(close(xw, 10, 0.1), `expected ~10, got ${xw}`);
  });
});
