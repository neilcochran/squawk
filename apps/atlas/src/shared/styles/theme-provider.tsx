import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import {
  DARK_CLASS_NAME,
  PREFERS_DARK_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  ThemeContext,
  isThemePreference,
} from './theme-context.ts';
import type { ResolvedTheme, ThemePreference } from './theme-context.ts';

/**
 * Props for {@link ThemeProvider}.
 */
export interface ThemeProviderProps {
  /** App tree that should receive the theme context. */
  children: ReactNode;
}

/**
 * Top-level provider that owns the active theme preference and keeps
 * `documentElement.classList` in sync with the resolved theme. Mount
 * this once near the root of the app (above the router) so every
 * descendant - the shell, the inspector, and every chart layer - reads
 * the same source of truth via {@link useTheme} or
 * {@link useResolvedTheme}.
 *
 * Behavior:
 *
 * - Reads the persisted preference from `localStorage[THEME_STORAGE_KEY]`
 *   on mount; falls back to `'system'` when the key is missing or
 *   carries a stale value the type guard rejects.
 * - Resolves `'system'` against the `(prefers-color-scheme: dark)`
 *   media query and subscribes to `change` events so the app follows
 *   the OS preference live while the user is on `'system'`.
 * - Writes `.dark` to `documentElement` whenever the resolved theme is
 *   dark and removes it otherwise. The `<html>` flag is the same hook
 *   the FOUC bootstrap in `main.tsx` writes pre-mount, so the class
 *   transition stays continuous from the very first paint.
 * - Persists every preference change back to localStorage on update,
 *   so a refresh reproduces the chosen state.
 */
export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    readSystemPrefersDark(),
  );

  // Subscribe to OS theme changes so a `'system'` preference follows the
  // user toggling their OS dark mode without requiring a refresh.
  // matchMedia is unavailable in SSR / older test environments;
  // bail out cleanly so the provider still renders.
  useEffect((): (() => void) | undefined => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mq = window.matchMedia(PREFERS_DARK_MEDIA_QUERY);
    function handleChange(event: MediaQueryListEvent): void {
      setSystemPrefersDark(event.matches);
    }
    mq.addEventListener('change', handleChange);
    return (): void => {
      mq.removeEventListener('change', handleChange);
    };
  }, []);

  const resolved: ResolvedTheme =
    preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference;

  // Keep `documentElement` in sync with the resolved theme. The class
  // is the hook the custom Tailwind `dark:` variant targets and the
  // same class the FOUC bootstrap in `main.tsx` writes before React
  // mounts.
  useEffect((): void => {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add(DARK_CLASS_NAME);
    } else {
      root.classList.remove(DARK_CLASS_NAME);
    }
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference): void => {
    setPreferenceState(next);
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage may throw under privacy modes / disabled storage;
      // the in-memory preference still updates so the session works,
      // it just will not persist across reloads.
    }
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Reads the persisted theme preference from localStorage, falling
 * back to `'system'` when the key is missing, the storage API is
 * unavailable, or the stored value fails the type guard. Pulled out
 * of the provider body so the lazy `useState` initializer stays
 * readable.
 */
function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system';
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) {
      return stored;
    }
  } catch {
    // Privacy-mode browsers throw on getItem; fall through to default.
  }
  return 'system';
}

/**
 * Reads the current OS dark-mode preference, defaulting to `false`
 * when the matchMedia API is unavailable. Pulled out of the provider
 * body so the lazy `useState` initializer stays readable.
 */
function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(PREFERS_DARK_MEDIA_QUERY).matches;
}
