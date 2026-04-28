import { useEffect, useState } from 'react';

/**
 * CSS media query that resolves true when the primary input device can
 * hover - mouse / trackpad on a desktop or laptop. Resolves false on
 * touch-only devices like phones and most tablets, even though those
 * devices synthesize `mouseenter` events from a tap. Used to gate
 * hover-preview affordances (chip-hover camera pan, popover-item
 * highlight on hover) so they do not fire from synthesized touch
 * events.
 */
const HOVER_QUERY = '(hover: hover)';

/**
 * Returns whether the user's primary input device supports a real
 * hover gesture. Subscribes to `change` events on the underlying
 * `MediaQueryList` so the value updates if the user attaches or
 * detaches a mouse mid-session (rare on phones, common on
 * iPad-with-trackpad and Surface tablets).
 *
 * Use this to conditionally attach `onMouseEnter` / `onMouseLeave`
 * handlers - omit them on `(hover: none)` so synthesized mouse events
 * from taps do not trigger preview-and-restore artifacts. Keep
 * `onFocus` / `onBlur` attached regardless so keyboard navigation
 * still drives the same affordance on any device.
 */
export function useCanHover(): boolean {
  const [canHover, setCanHover] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(HOVER_QUERY).matches;
  });
  useEffect((): (() => void) | undefined => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mq = window.matchMedia(HOVER_QUERY);
    function handleChange(event: MediaQueryListEvent): void {
      setCanHover(event.matches);
    }
    mq.addEventListener('change', handleChange);
    return (): void => {
      mq.removeEventListener('change', handleChange);
    };
  }, []);
  return canHover;
}
