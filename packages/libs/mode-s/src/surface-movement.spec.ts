import { describe, it, expect } from 'vitest';

import { decodeSurfaceMovement } from './surface-movement.js';

describe('decodeSurfaceMovement', () => {
  it('returns undefined for 0 (no information)', () => {
    expect(decodeSurfaceMovement(0)).toBeUndefined();
  });

  it('returns undefined for values beyond the defined range (>124)', () => {
    expect(decodeSurfaceMovement(125)).toBeUndefined();
    expect(decodeSurfaceMovement(127)).toBeUndefined();
  });

  it('returns 0 for the stopped sentinel (1)', () => {
    expect(decodeSurfaceMovement(1)).toBe(0);
  });

  it('returns 175 for the max sentinel (124)', () => {
    expect(decodeSurfaceMovement(124)).toBe(175);
  });

  it.each([
    [2, 0.125], // start of the 0.125 kt/step bin
    [8, 0.875], // last value in the 0.125 kt/step bin
    [9, 1], // start of the 0.25 kt/step bin
    [13, 2], // start of the 0.5 kt/step bin
    [39, 15], // start of the 1 kt/step bin
    [94, 70], // start of the 2 kt/step bin
    [109, 100], // start of the 5 kt/step bin
    [123, 170], // last value before the 175 sentinel
  ])('decodes movement field %i to %i kt', (field, expectedKt) => {
    expect(decodeSurfaceMovement(field)).toBeCloseTo(expectedKt, 3);
  });

  it('increases monotonically across the whole defined range', () => {
    let previous = -1;
    for (let field = 1; field <= 124; field++) {
      const speed = decodeSurfaceMovement(field);
      expect(speed).toBeDefined();
      if (speed !== undefined) {
        expect(speed).toBeGreaterThanOrEqual(previous);
        previous = speed;
      }
    }
  });
});
