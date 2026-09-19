/** CSS pixels per rem when the root font size cannot be read: the browser default. */
export const DEFAULT_PX_PER_REM = 16;

/**
 * Reads how many CSS pixels one rem currently is, from the root element's
 * computed font size. Canvas drawing has to be done in pixels, so the scope's
 * sizes are authored in rem and converted at draw time - which makes the
 * canvas follow the user's browser font-size setting and any responsive root
 * font size, the same way the HTML chrome around it does.
 *
 * @param root - The document's root element.
 * @returns CSS pixels per rem, or {@link DEFAULT_PX_PER_REM} if the font size is missing or unusable.
 */
export function readPxPerRem(root: Element): number {
  const fontSizePx = Number.parseFloat(getComputedStyle(root).fontSize);
  return Number.isFinite(fontSizePx) && fontSizePx > 0 ? fontSizePx : DEFAULT_PX_PER_REM;
}
