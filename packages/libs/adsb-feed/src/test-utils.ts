/**
 * Test-only helper: collects the `detail` payload of every event of `type`
 * dispatched on `target`, in dispatch order.
 */
export function collectEventDetails<T>(target: EventTarget, type: string): T[] {
  const details: T[] = [];
  target.addEventListener(type, (event) => {
    details.push((event as CustomEvent<T>).detail);
  });
  return details;
}
