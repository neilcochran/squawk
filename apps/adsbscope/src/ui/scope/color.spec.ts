import { describe, expect, it } from 'vitest';

import { hexWithAlpha, isHexColor } from './color.js';

describe('isHexColor', () => {
  it('accepts six-digit hex in either case', () => {
    expect(isHexColor('#33ff66')).toBe(true);
    expect(isHexColor('#33FF66')).toBe(true);
  });

  it('rejects every other color form', () => {
    expect(isHexColor('#3f6')).toBe(false);
    expect(isHexColor('#33ff6680')).toBe(false);
    expect(isHexColor('33ff66')).toBe(false);
    expect(isHexColor('rgb(51, 255, 102)')).toBe(false);
    expect(isHexColor('green')).toBe(false);
  });
});

describe('hexWithAlpha', () => {
  it('appends the alpha as a two-digit hex channel', () => {
    expect(hexWithAlpha('#33ff66', 1)).toBe('#33ff66ff');
    expect(hexWithAlpha('#33ff66', 0)).toBe('#33ff6600');
    expect(hexWithAlpha('#33ff66', 0.5)).toBe('#33ff6680');
    expect(hexWithAlpha('#33ff66', 0.02)).toBe('#33ff6605');
  });

  it('clamps alpha to the 0-1 range', () => {
    expect(hexWithAlpha('#33ff66', 2)).toBe('#33ff66ff');
    expect(hexWithAlpha('#33ff66', -1)).toBe('#33ff6600');
  });

  it('returns a color it cannot extend unchanged', () => {
    expect(hexWithAlpha('green', 0.5)).toBe('green');
  });
});
