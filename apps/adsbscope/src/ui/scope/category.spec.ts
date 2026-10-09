import { describe, expect, it } from 'vitest';

import { AircraftCategory } from '@squawk/types';

import {
  categoryCode,
  categoryLabel,
  isHeavyCategory,
  knownCategory,
  positionSymbol,
} from './category.js';

const EVERY_CATEGORY = Object.values(AircraftCategory);

describe('knownCategory', () => {
  it('treats a missing category and an unknown one alike', () => {
    expect(knownCategory(undefined)).toBeUndefined();
    expect(knownCategory('unknown')).toBeUndefined();
    expect(knownCategory('heavy')).toBe('heavy');
  });
});

describe('positionSymbol', () => {
  it('draws fixed-wing aircraft of every weight class as a square, as it does an aircraft with no category', () => {
    for (const category of ['light', 'small', 'large', 'highVortexLarge', 'heavy'] as const) {
      expect(positionSymbol(category)).toBe('square');
    }
    expect(positionSymbol(undefined)).toBe('square');
    expect(positionSymbol('unknown')).toBe('square');
  });

  it('gives rotorcraft, unpowered aircraft, drones, and surface vehicles shapes of their own', () => {
    expect(positionSymbol('rotorcraft')).toBe('circle');
    expect(positionSymbol('glider')).toBe('triangle');
    expect(positionSymbol('lighterThanAir')).toBe('triangle');
    expect(positionSymbol('ultralight')).toBe('triangle');
    expect(positionSymbol('uav')).toBe('diamond');
    expect(positionSymbol('surfaceServiceVehicle')).toBe('cross');
    expect(positionSymbol('surfaceEmergencyVehicle')).toBe('cross');
  });

  it('has a symbol for every category', () => {
    for (const category of EVERY_CATEGORY) {
      expect(['square', 'circle', 'triangle', 'diamond', 'cross']).toContain(
        positionSymbol(category),
      );
    }
  });
});

describe('isHeavyCategory', () => {
  it('is true for a heavy alone', () => {
    expect(isHeavyCategory('heavy')).toBe(true);
    expect(isHeavyCategory('highVortexLarge')).toBe(false);
    expect(isHeavyCategory('large')).toBe(false);
    expect(isHeavyCategory(undefined)).toBe(false);
  });
});

describe('categoryCode', () => {
  it('gives every known category a three-letter code, and none to a missing or unknown one', () => {
    expect(categoryCode('heavy')).toBe('HVY');
    expect(categoryCode('large')).toBe('LRG');
    expect(categoryCode('light')).toBe('LGT');
    expect(categoryCode('rotorcraft')).toBe('ROT');
    expect(categoryCode(undefined)).toBeUndefined();
    expect(categoryCode('unknown')).toBeUndefined();
    for (const category of EVERY_CATEGORY.filter((value) => value !== 'unknown')) {
      expect(categoryCode(category)).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe('categoryLabel', () => {
  it('names every known category, with its weight class where there is one', () => {
    expect(categoryLabel('heavy')).toBe('Heavy (over 300,000 lb)');
    expect(categoryLabel('rotorcraft')).toBe('Rotorcraft');
    expect(categoryLabel(undefined)).toBeUndefined();
    expect(categoryLabel('unknown')).toBeUndefined();
    for (const category of EVERY_CATEGORY.filter((value) => value !== 'unknown')) {
      expect(categoryLabel(category)).toBeTruthy();
    }
  });
});
