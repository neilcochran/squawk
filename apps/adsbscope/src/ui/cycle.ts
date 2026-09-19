/**
 * Finds the item after `current` in a list, wrapping from the last back to
 * the first - the step a control takes when it cycles through its options. A
 * `current` that is not in the list steps to the first item.
 *
 * @param items - The options, in order. Never empty.
 * @param current - The option selected now.
 * @returns The option to select next.
 */
export function nextInCycle<Item>(items: readonly [Item, ...Item[]], current: Item): Item {
  let next = items[0];
  let takeNext = false;
  for (const item of items) {
    if (takeNext) {
      next = item;
      break;
    }
    takeNext = item === current;
  }
  return next;
}
