import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { useChartColors } from './chart-colors.ts';
import type { ChartColorPalette } from './chart-colors.ts';
import { ThemeProvider } from './theme-provider.tsx';
import { PREFERS_DARK_MEDIA_QUERY, THEME_STORAGE_KEY } from './theme-context.ts';

/**
 * Builds a matchMedia stub honoring the supplied dark preference for
 * `(prefers-color-scheme: dark)` and falling through to `matches: true`
 * for every other query (matching the global shim).
 */
function stubMatchMedia(prefersDark: boolean): void {
  vi.stubGlobal('matchMedia', (query: string): MediaQueryList => {
    const matches = query === PREFERS_DARK_MEDIA_QUERY ? prefersDark : true;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: (): void => {},
      removeListener: (): void => {},
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
      dispatchEvent: (): boolean => false,
    };
  });
}

/**
 * Test probe that reads the resolved palette and exposes a few
 * representative tokens for assertions. Passing the palette object
 * straight to the test would be cleaner if React rendered objects, so
 * we expose the fields in `data-*` attributes instead.
 */
function PaletteProbe({
  onResolve,
}: {
  onResolve: (palette: ChartColorPalette) => void;
}): ReactElement {
  const colors = useChartColors();
  onResolve(colors);
  return <span />;
}

describe('useChartColors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('returns the light palette under a light theme preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    stubMatchMedia(true);
    let resolved!: ChartColorPalette;
    render(
      <ThemeProvider>
        <PaletteProbe
          onResolve={(palette): void => {
            resolved = palette;
          }}
        />
      </ThemeProvider>,
    );
    // Light-palette signature: dark slate minor airport, dark highlight stroke.
    expect(resolved.airport.minor).toBe('#0f172a');
    expect(resolved.highlight.stroke).toBe('#0f172a');
    expect(resolved.symbolStroke).toBe('#ffffff');
  });

  it('returns the dark palette under a dark theme preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    stubMatchMedia(false);
    let resolved!: ChartColorPalette;
    render(
      <ThemeProvider>
        <PaletteProbe
          onResolve={(palette): void => {
            resolved = palette;
          }}
        />
      </ThemeProvider>,
    );
    // Dark-palette signature: lifted minor airport, lighter highlight stroke,
    // and the dark airway low color is bright slate (vs light's dark slate).
    expect(resolved.airport.minor).toBe('#cbd5e1');
    expect(resolved.highlight.stroke).toBe('#cbd5e1');
    expect(resolved.airway.low).toBe('#cbd5e1');
  });

  it('falls back to the light palette when no provider is mounted', () => {
    let resolved!: ChartColorPalette;
    render(
      <PaletteProbe
        onResolve={(palette): void => {
          resolved = palette;
        }}
      />,
    );
    expect(resolved.airport.minor).toBe('#0f172a');
  });
});
