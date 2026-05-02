import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { isThemePreference, useTheme } from './theme-context.js';

describe('isThemePreference', () => {
  it('accepts the three valid theme preference strings', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('system')).toBe(true);
  });

  it('rejects unknown strings, numbers, null, and undefined', () => {
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference('')).toBe(false);
    expect(isThemePreference(0)).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});

describe('useTheme outside a provider', () => {
  it('returns the safe defaults and a no-op setPreference', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('system');
    expect(result.current.resolved).toBe('light');
    // Calling the default setPreference should be a silent no-op.
    expect(() => result.current.setPreference('dark')).not.toThrow();
  });
});
