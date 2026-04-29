import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeProvider } from './theme-provider.tsx';
import {
  DARK_CLASS_NAME,
  PREFERS_DARK_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  useTheme,
} from './theme-context.ts';

/**
 * Builds a matchMedia stub that lets tests force a specific
 * `prefers-color-scheme: dark` outcome and dispatch live changes to
 * subscribed listeners. Other queries default to `matches: true` to
 * preserve the global shim's desktop-hover convention.
 *
 * Stores listeners as the standard `EventListenerOrEventListenerObject`
 * union so the stub satisfies the strict `MediaQueryList` interface,
 * and dispatches real `MediaQueryListEvent` instances on change so
 * subscribers receive the same shape they would in a real browser.
 */
function buildMatchMediaStub(initialPrefersDark: boolean): {
  matchMedia: (query: string) => MediaQueryList;
  setPrefersDark: (next: boolean) => void;
} {
  let prefersDark = initialPrefersDark;
  const listenersByQuery = new Map<string, Set<EventListenerOrEventListenerObject>>();
  function matchMedia(query: string): MediaQueryList {
    const matches = query === PREFERS_DARK_MEDIA_QUERY ? prefersDark : true;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: (): void => {},
      removeListener: (): void => {},
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject): void => {
        if (type !== 'change') {
          return;
        }
        const bucket = listenersByQuery.get(query) ?? new Set<EventListenerOrEventListenerObject>();
        bucket.add(listener);
        listenersByQuery.set(query, bucket);
      },
      removeEventListener: (type: string, listener: EventListenerOrEventListenerObject): void => {
        if (type !== 'change') {
          return;
        }
        listenersByQuery.get(query)?.delete(listener);
      },
      dispatchEvent: (): boolean => false,
    };
  }
  function setPrefersDark(next: boolean): void {
    prefersDark = next;
    const subs = listenersByQuery.get(PREFERS_DARK_MEDIA_QUERY);
    if (subs === undefined) {
      return;
    }
    // jsdom does not expose `MediaQueryListEvent`, so build a regular
    // `Event` and augment it with the `matches` / `media` fields via
    // `Object.assign`. The listener stored as
    // `EventListenerOrEventListenerObject` accepts a plain `Event`, and
    // the provider's real handler only reads `event.matches`.
    const event = Object.assign(new Event('change'), {
      matches: next,
      media: PREFERS_DARK_MEDIA_QUERY,
    });
    for (const listener of subs) {
      if (typeof listener === 'function') {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    }
  }
  return { matchMedia, setPrefersDark };
}

/**
 * Test probe rendered inside the provider that surfaces the resolved
 * theme and the user preference into the DOM where Testing Library can
 * read them.
 */
function ThemeProbe(): ReactElement {
  const { preference, resolved } = useTheme();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS_NAME);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS_NAME);
  });

  it('defaults to system when no preference is stored', () => {
    const { matchMedia } = buildMatchMediaStub(false);
    vi.stubGlobal('matchMedia', matchMedia);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass(DARK_CLASS_NAME);
  });

  it('resolves system to dark when prefers-color-scheme matches', () => {
    const { matchMedia } = buildMatchMediaStub(true);
    vi.stubGlobal('matchMedia', matchMedia);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass(DARK_CLASS_NAME);
  });

  it('reads explicit dark preference from localStorage', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { matchMedia } = buildMatchMediaStub(false);
    vi.stubGlobal('matchMedia', matchMedia);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('dark');
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass(DARK_CLASS_NAME);
  });

  it('explicit light preference wins over a dark OS preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { matchMedia } = buildMatchMediaStub(true);
    vi.stubGlobal('matchMedia', matchMedia);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('light');
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass(DARK_CLASS_NAME);
  });

  it('falls back to system when the stored value is invalid', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-real-value');
    const { matchMedia } = buildMatchMediaStub(false);
    vi.stubGlobal('matchMedia', matchMedia);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
  });

  it('follows a live OS theme change while on system', () => {
    const { matchMedia, setPrefersDark } = buildMatchMediaStub(false);
    vi.stubGlobal('matchMedia', matchMedia);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    act(() => {
      setPrefersDark(true);
    });
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass(DARK_CLASS_NAME);
  });
});

/**
 * Test rig that exposes the provider's setter through real buttons.
 * Driving the side effect through DOM events (instead of capturing the
 * hook return into a module-scope let) keeps the test pure-render and
 * satisfies the `react-hooks/globals` lint rule.
 */
function PreferenceSetterButtons(): ReactElement {
  const { setPreference } = useTheme();
  return (
    <div>
      <button type="button" onClick={(): void => setPreference('light')}>
        set light
      </button>
      <button type="button" onClick={(): void => setPreference('dark')}>
        set dark
      </button>
      <button type="button" onClick={(): void => setPreference('system')}>
        set system
      </button>
    </div>
  );
}

describe('useTheme().setPreference', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS_NAME);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.documentElement.classList.remove(DARK_CLASS_NAME);
  });

  it('writes the new preference to localStorage and toggles the dark class', () => {
    const { matchMedia } = buildMatchMediaStub(false);
    vi.stubGlobal('matchMedia', matchMedia);
    render(
      <ThemeProvider>
        <PreferenceSetterButtons />
      </ThemeProvider>,
    );
    expect(document.documentElement).not.toHaveClass(DARK_CLASS_NAME);
    fireEvent.click(screen.getByRole('button', { name: 'set dark' }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement).toHaveClass(DARK_CLASS_NAME);
    fireEvent.click(screen.getByRole('button', { name: 'set light' }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement).not.toHaveClass(DARK_CLASS_NAME);
  });
});
