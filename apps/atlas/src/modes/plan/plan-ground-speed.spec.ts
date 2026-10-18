import { describe, expect, it } from 'vitest';

import { resolveGroundSpeedInput } from './plan-ground-speed.ts';

describe('resolveGroundSpeedInput', () => {
  it('commits an in-range speed as typed', () => {
    expect(resolveGroundSpeedInput('450', undefined)).toBe(450);
  });

  it('ignores surrounding whitespace', () => {
    expect(resolveGroundSpeedInput('  450 ', undefined)).toBe(450);
  });

  it('clears the speed for a blank field', () => {
    expect(resolveGroundSpeedInput('', 450)).toBeUndefined();
    expect(resolveGroundSpeedInput('   ', 450)).toBeUndefined();
  });

  it('clamps a speed above the URL bound down to it', () => {
    expect(resolveGroundSpeedInput('5000', 450)).toBe(2000);
  });

  it('clamps a positive speed below the URL bound up to it', () => {
    expect(resolveGroundSpeedInput('0.5', undefined)).toBe(1);
  });

  it('keeps the current speed for zero or a negative number', () => {
    expect(resolveGroundSpeedInput('0', 450)).toBe(450);
    expect(resolveGroundSpeedInput('-120', 450)).toBe(450);
  });

  it('keeps the current speed for text that is not a number', () => {
    expect(resolveGroundSpeedInput('fast', 450)).toBe(450);
    expect(resolveGroundSpeedInput('fast', undefined)).toBeUndefined();
  });
});
