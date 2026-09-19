const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_CHANNEL = 255;

/**
 * Whether a string is a six-digit hex color, the one form theme colors are
 * written in so that {@link hexWithAlpha} can derive translucent variants.
 *
 * @param color - The candidate color string.
 * @returns True for `#rrggbb`.
 */
export function isHexColor(color: string): boolean {
  return HEX_COLOR.test(color);
}

/**
 * Derives a translucent variant of a six-digit hex color, as an eight-digit
 * hex color. Used where a color has to carry its own alpha - a gradient stop
 * cannot use the context's `globalAlpha` - so a theme only ever states each
 * color once, opaque.
 *
 * @param color - A `#rrggbb` color.
 * @param alpha - Opacity from 0 to 1; values outside that are clamped.
 * @returns The `#rrggbbaa` color, or `color` unchanged if it is not six-digit hex.
 */
export function hexWithAlpha(color: string, alpha: number): string {
  if (!isHexColor(color)) {
    return color;
  }
  const clamped = Math.min(1, Math.max(0, alpha));
  const channel = Math.round(clamped * MAX_CHANNEL)
    .toString(16)
    .padStart(2, '0');
  return `${color}${channel}`;
}
