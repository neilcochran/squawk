/**
 * Tiny module-scoped pub/sub the "reset view" affordance uses to cross the
 * shell <-> mode boundary without coupling them. The shell mode switcher
 * fires `dispatchViewReset()` when the user clicks the link of the mode they
 * are already on; the mounted mode subscribes through `ViewResetListener` and
 * reacts by easing the map back to the default CONUS view.
 *
 * One bus serves every mode because at most one mode is mounted at a time,
 * so whichever listener is subscribed belongs to the mode on screen. A
 * module-level listener set is the lightest viable coordination primitive;
 * React fast-refresh re-mounts cause subscribers to re-register, and the
 * unmount cleanup keeps the set clean.
 */

/**
 * Callback invoked when a view reset is requested. Side-effecting (the
 * mounted mode mutates the map's camera); no return value.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Registers a listener that fires every time `dispatchViewReset` is called.
 * Returns an unsubscribe function the caller MUST call on cleanup (typically
 * from the cleanup phase of a `useEffect`) to avoid leaking subscriptions
 * across mounts.
 *
 * @param listener - Callback to invoke on each reset request.
 * @returns Unsubscribe function.
 */
export function subscribeViewReset(listener: Listener): () => void {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
}

/**
 * Notifies every active subscriber that the map view should reset to its
 * default state. Iterates a snapshot of the listener set so a listener that
 * unsubscribes itself during the dispatch does not skip a sibling.
 */
export function dispatchViewReset(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}
