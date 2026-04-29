import { createContext, useContext } from 'react';

/**
 * User-selectable theme preference. `'light'` and `'dark'` are explicit
 * overrides that win regardless of the operating system; `'system'`
 * defers to the `prefers-color-scheme` media query so the app follows
 * whichever setting the OS reports.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

/**
 * Concrete theme actually applied to the DOM and the chart palette
 * after the `'system'` preference has been resolved against the
 * `prefers-color-scheme` media query. UI code that wants to branch on
 * "is the page light or dark right now?" reads {@link useResolvedTheme}
 * and matches against this union instead of {@link ThemePreference},
 * which carries the indirection.
 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Shape of the value carried by {@link ThemeContext}. The provider builds
 * this by reading the persisted preference, listening to the system
 * preference, and exposing a setter that both writes localStorage and
 * applies the `.dark` class to `documentElement`.
 */
export interface ThemeContextValue {
  /** Currently-stored user preference (light / dark / system). */
  preference: ThemePreference;
  /**
   * Concrete theme after resolving `'system'` against the OS preference
   * (`prefers-color-scheme: dark`). Always `'light'` or `'dark'`,
   * never `'system'`.
   */
  resolved: ResolvedTheme;
  /** Updates the persisted preference and re-resolves the theme. */
  setPreference: (preference: ThemePreference) => void;
}

/**
 * localStorage key used by the provider to persist the user's choice
 * across sessions. Exported so the FOUC bootstrap script in `main.tsx`
 * can read it before React mounts and apply the matching class to
 * `documentElement` synchronously, avoiding a white flash on first
 * paint when the resolved theme is dark.
 */
export const THEME_STORAGE_KEY = 'atlas:theme';

/**
 * CSS media query the provider listens on to resolve the `'system'`
 * preference. Exported so tests and the FOUC bootstrap can use the
 * same string and stay in lockstep.
 */
export const PREFERS_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Class name applied to `documentElement` whenever the resolved theme
 * is dark. The custom `dark:` Tailwind variant in `src/index.css`
 * targets this class.
 */
export const DARK_CLASS_NAME = 'dark';

/**
 * Default value for the context, used when a consumer renders outside
 * the provider (e.g. an isolated test that mounts a single component
 * without the shell). The default keeps the resolved theme on
 * `'light'`, exposes a no-op setter, and ensures hooks remain safe to
 * call - matching the safe-defaults convention used by
 * `highlight-context.ts`.
 */
const DEFAULT_VALUE: ThemeContextValue = {
  preference: 'system',
  resolved: 'light',
  setPreference: (): void => {},
};

/**
 * React context carrying the active theme preference, the resolved
 * theme, and the setter. Populated by `<ThemeProvider>` in
 * `theme-provider.tsx`; consumed via {@link useTheme} and
 * {@link useResolvedTheme}.
 */
export const ThemeContext = createContext<ThemeContextValue>(DEFAULT_VALUE);

/**
 * Reads the full {@link ThemeContextValue} from the surrounding
 * provider. Use this when both the user-selected preference and the
 * setter are needed (e.g. the theme-switcher dropdown). Components
 * that only need the resolved light / dark theme should prefer
 * {@link useResolvedTheme} so re-renders are limited to the resolved
 * value changing.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Reads the resolved (post-`'system'`-resolution) theme from the
 * surrounding provider. Use this from chart-color hooks, basemap
 * components, and anywhere the UI cares only about "is this light or
 * dark right now?" rather than the user's preference indirection.
 */
export function useResolvedTheme(): ResolvedTheme {
  return useContext(ThemeContext).resolved;
}

/**
 * Type guard that narrows an unknown localStorage value to a valid
 * {@link ThemePreference}. Defensive against a stale or hand-edited
 * key surviving across schema changes; callers fall back to the
 * default preference (`'system'`) when the guard returns false.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}
