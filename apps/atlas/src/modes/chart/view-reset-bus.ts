/**
 * Tiny module-scoped pub/sub the chart-mode "reset view" affordance uses to
 * cross the shell <-> mode boundary without coupling them. The shell mode
 * switcher fires `dispatchChartViewReset()` when the user clicks the Chart
 * link while already on `/chart`; the chart mode subscribes and reacts by
 * easing the map back to the default CONUS view (and resetting pitch to 0).
 *
 * This lives in `modes/chart/` rather than `shared/` because the listener
 * is chart-specific. The dispatcher is exported so any caller in any layer
 * can fire a reset, but in practice only the mode switcher does.
 *
 * Module-level state is intentional: there is at most one chart mode
 * mounted at a time, so a singleton listener set is the lightest viable
 * coordination primitive. React fast-refresh re-mounts cause subscribers
 * to re-register; the unmount cleanup keeps the set clean.
 */

/**
 * Callback invoked when a chart-view reset is requested. Side-effecting
 * (the chart mode mutates the map's camera); no return value.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Registers a listener that fires every time `dispatchChartViewReset` is
 * called. Returns an unsubscribe function the caller MUST call on cleanup
 * (typically from the cleanup phase of a `useEffect`) to avoid leaking
 * subscriptions across mounts.
 *
 * @param listener - Callback to invoke on each reset request.
 * @returns Unsubscribe function.
 */
export function subscribeChartViewReset(listener: Listener): () => void {
  listeners.add(listener);
  return (): void => {
    listeners.delete(listener);
  };
}

/**
 * Notifies every active subscriber that the chart view should reset to its
 * default state. Iterates a snapshot of the listener set so a listener that
 * unsubscribes itself during the dispatch does not skip a sibling.
 */
export function dispatchChartViewReset(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}
