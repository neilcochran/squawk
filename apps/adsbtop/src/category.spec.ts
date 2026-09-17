import { describe, expect, it } from 'vitest';

import { AircraftCategory } from '@squawk/types';

import { categoryOrdinal, formatCategoryCode, formatCategoryLabel } from './category.js';

const EVERY_CATEGORY = Object.values(AircraftCategory);

describe('formatCategoryCode', () => {
  it('renders a three-letter code for every reported category except unknown', () => {
    for (const category of EVERY_CATEGORY) {
      const code = formatCategoryCode(category);
      if (category === 'unknown') {
        expect(code).toBe('-');
      } else {
        expect(code).toMatch(/^[A-Z]{3}$/);
      }
    }
  });

  it('gives every category a distinct code', () => {
    const codes = EVERY_CATEGORY.filter((category) => category !== 'unknown').map(
      formatCategoryCode,
    );
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses the expected codes for the common weight classes', () => {
    expect(formatCategoryCode('light')).toBe('LGT');
    expect(formatCategoryCode('large')).toBe('LRG');
    expect(formatCategoryCode('heavy')).toBe('HVY');
    expect(formatCategoryCode('rotorcraft')).toBe('ROT');
  });

  it('returns a placeholder when unreported', () => {
    expect(formatCategoryCode(undefined)).toBe('-');
  });
});

describe('formatCategoryLabel', () => {
  it('includes the weight class for the A-class weight categories', () => {
    expect(formatCategoryLabel('light')).toBe('Light (under 15,500 lb)');
    expect(formatCategoryLabel('large')).toBe('Large (75,000 to 300,000 lb)');
    expect(formatCategoryLabel('heavy')).toBe('Heavy (over 300,000 lb)');
  });

  it('labels every category and distinguishes unknown from unreported', () => {
    for (const category of EVERY_CATEGORY) {
      expect(formatCategoryLabel(category)).not.toBe('-');
    }
    expect(formatCategoryLabel('unknown')).toContain('Unknown');
    expect(formatCategoryLabel(undefined)).toBe('-');
  });
});

describe('categoryOrdinal', () => {
  it('orders the A-class weight categories ascending', () => {
    const light = categoryOrdinal('light');
    const large = categoryOrdinal('large');
    const heavy = categoryOrdinal('heavy');
    expect(light).toBeDefined();
    expect(large).toBeDefined();
    expect(heavy).toBeDefined();
    if (light !== undefined && large !== undefined && heavy !== undefined) {
      expect(light).toBeLessThan(large);
      expect(large).toBeLessThan(heavy);
    }
  });

  it('gives every category except unknown a distinct ordinal', () => {
    const ordinals = EVERY_CATEGORY.filter((category) => category !== 'unknown').map(
      categoryOrdinal,
    );
    expect(ordinals.every((ordinal) => ordinal !== undefined)).toBe(true);
    expect(new Set(ordinals).size).toBe(ordinals.length);
  });

  it('returns undefined for unreported and unknown so they sink to the bottom', () => {
    expect(categoryOrdinal(undefined)).toBeUndefined();
    expect(categoryOrdinal('unknown')).toBeUndefined();
  });
});
