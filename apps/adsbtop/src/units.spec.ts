import { describe, expect, it } from 'vitest';

import {
  distanceInUnits,
  distanceUnitSuffix,
  formatAltitudeValue,
  formatDistanceValue,
  formatSpeedValue,
  formatVerticalRateValue,
  isUnitSystem,
  toggleUnitSystem,
} from './units.js';

describe('isUnitSystem', () => {
  it('accepts exactly the two systems', () => {
    expect(isUnitSystem('aviation')).toBe(true);
    expect(isUnitSystem('metric')).toBe(true);
    expect(isUnitSystem('imperial')).toBe(false);
    expect(isUnitSystem('')).toBe(false);
  });
});

describe('toggleUnitSystem', () => {
  it('flips between the two systems', () => {
    expect(toggleUnitSystem('aviation')).toBe('metric');
    expect(toggleUnitSystem('metric')).toBe('aviation');
  });
});

describe('formatAltitudeValue', () => {
  it('renders feet or metres, rounded, with a placeholder for unknown', () => {
    expect(formatAltitudeValue(35_000, 'aviation')).toBe('35000ft');
    expect(formatAltitudeValue(35_000, 'metric')).toBe('10668m');
    expect(formatAltitudeValue(undefined, 'metric')).toBe('-');
  });
});

describe('formatSpeedValue', () => {
  it('renders knots or km/h, rounded, with a placeholder for unknown', () => {
    expect(formatSpeedValue(515, 'aviation')).toBe('515kt');
    expect(formatSpeedValue(515, 'metric')).toBe('954km/h');
    expect(formatSpeedValue(undefined, 'aviation')).toBe('-');
  });
});

describe('formatVerticalRateValue', () => {
  it('renders feet per minute with a plus on climbs', () => {
    expect(formatVerticalRateValue(1200, 'aviation')).toBe('+1200fpm');
    expect(formatVerticalRateValue(-800, 'aviation')).toBe('-800fpm');
    expect(formatVerticalRateValue(0, 'aviation')).toBe('0fpm');
  });

  it('renders metres per second to one decimal with a plus on climbs', () => {
    expect(formatVerticalRateValue(1200, 'metric')).toBe('+6.1m/s');
    expect(formatVerticalRateValue(-800, 'metric')).toBe('-4.1m/s');
    expect(formatVerticalRateValue(0, 'metric')).toBe('0.0m/s');
  });

  it('shows a placeholder for unknown', () => {
    expect(formatVerticalRateValue(undefined, 'metric')).toBe('-');
  });
});

describe('distanceInUnits / distanceUnitSuffix', () => {
  it('leaves nautical miles alone and converts to kilometres for metric', () => {
    expect(distanceInUnits(100, 'aviation')).toBe(100);
    expect(distanceInUnits(100, 'metric')).toBeCloseTo(185.2, 1);
    expect(distanceUnitSuffix('aviation')).toBe('nm');
    expect(distanceUnitSuffix('metric')).toBe('km');
  });
});

describe('formatDistanceValue', () => {
  it('renders whole nautical miles or kilometres, with a placeholder for unknown', () => {
    expect(formatDistanceValue(212.4, 'aviation')).toBe('212nm');
    expect(formatDistanceValue(212.4, 'metric')).toBe('393km');
    expect(formatDistanceValue(undefined, 'aviation')).toBe('-');
  });
});
