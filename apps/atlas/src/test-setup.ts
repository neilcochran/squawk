/**
 * Vitest setup file. Imported automatically before each test file via the
 * `test.setupFiles` entry in `vite.config.ts`. Pulls in the
 * `@testing-library/jest-dom` matchers (`toBeInTheDocument`,
 * `toHaveTextContent`, `toHaveClass`, etc.) so component specs can use
 * them as drop-in extensions to Vitest's `expect`. Also registers an
 * `afterEach(cleanup)` so each test starts with a fresh DOM - Vitest does
 * not enable test-framework globals by default, so RTL's auto-cleanup
 * cannot register itself and components from prior tests would otherwise
 * accumulate in the document.
 *
 * Provides a minimal `window.matchMedia` shim for jsdom, which omits the
 * API entirely. Most queries default to `matches: true` so hooks like
 * `useCanHover` (which inspects `(hover: hover)`) treat the test
 * environment as a desktop with a real hover gesture - matching the
 * default UX that hover-dependent specs were originally written against.
 *
 * `prefers-color-scheme: dark` is the one explicit exception: it
 * defaults to `false` so tests that resolve theme from the system
 * preference deterministically pick the light theme regardless of the
 * host machine's OS setting. Tests that need to exercise the dark /
 * touch / no-hover path can override this per-suite by stubbing
 * `window.matchMedia`.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: query !== '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: (): void => {},
    removeListener: (): void => {},
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
    dispatchEvent: (): boolean => false,
  });
}

afterEach(cleanup);
