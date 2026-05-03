import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { routeTree } from './routeTree.gen.ts';
import {
  DARK_CLASS_NAME,
  PREFERS_DARK_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  isThemePreference,
} from './shared/styles/theme-context.ts';
import { ThemeProvider } from './shared/styles/theme-provider.tsx';

// FOUC guard. Resolve the persisted theme preference (or the OS preference
// when the user is on `'system'`) and apply the `.dark` class to
// `documentElement` synchronously, before React mounts and before the
// first paint. Without this, a refresh under dark mode would briefly
// flash the light palette while React works through its initial render
// and the provider's effect schedules the className update.
//
// Mirrors the read logic in `ThemeProvider`; both fall back to `'system'`
// on a missing or stale storage value, and both honor
// `prefers-color-scheme` for the system case. Wrapped in try/catch so a
// privacy-mode browser that throws on localStorage access still boots.
applyInitialThemeClass();

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);

/**
 * Reads the stored theme preference (or the OS preference when the
 * stored value is `'system'`) and writes the matching class onto
 * `documentElement`. Runs synchronously at module load so the class
 * is in place before React's first paint.
 */
function applyInitialThemeClass(): void {
  let preference: 'light' | 'dark' | 'system' = 'system';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) {
      preference = stored;
    }
  } catch {
    // Privacy-mode storage rejection - fall through to the system default.
  }
  let isDark = false;
  if (preference === 'dark') {
    isDark = true;
  } else if (preference === 'system' && typeof window.matchMedia === 'function') {
    isDark = window.matchMedia(PREFERS_DARK_MEDIA_QUERY).matches;
  }
  if (isDark) {
    document.documentElement.classList.add(DARK_CLASS_NAME);
  } else {
    document.documentElement.classList.remove(DARK_CLASS_NAME);
  }
}
