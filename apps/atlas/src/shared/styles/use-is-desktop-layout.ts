import { useEffect, useState } from 'react';

/**
 * CSS media query matching Tailwind's `md:` breakpoint (48rem), the one
 * breakpoint the app uses: at or above it a side panel sits along the right
 * edge, below it the same panel is a bottom sheet.
 */
const DESKTOP_LAYOUT_QUERY = '(min-width: 48rem)';

/**
 * Returns whether the viewport is at or above the `md:` breakpoint, where the
 * layout is the desktop one. Subscribes to `change` events on the underlying
 * `MediaQueryList`, so the value follows a window resize or a phone rotating
 * across the breakpoint mid-session.
 *
 * Reach for this only when behavior, not just styling, differs by layout -
 * for example state that applies to the bottom sheet but must not carry over
 * to the right-edge panel. Pure styling differences belong in `md:` classes.
 *
 * @returns `true` at the desktop layout, `false` below it or without `matchMedia`.
 */
export function useIsDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(DESKTOP_LAYOUT_QUERY).matches;
  });
  useEffect((): (() => void) | undefined => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mq = window.matchMedia(DESKTOP_LAYOUT_QUERY);
    function handleChange(event: MediaQueryListEvent): void {
      setIsDesktop(event.matches);
    }
    mq.addEventListener('change', handleChange);
    return (): void => {
      mq.removeEventListener('change', handleChange);
    };
  }, []);
  return isDesktop;
}
