/**
 * The eight block glyphs a sparkline is drawn with, lowest to highest.
 * Deliberately non-ASCII: block elements are the standard way to draw a
 * one-line chart in a terminal, and nothing in ASCII reads as clearly.
 */
const BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Draws `values` as a one-line bar chart, one glyph per value, scaled so
 * the largest value (or `max`, if given and larger) fills the tallest
 * glyph. Zero draws the lowest glyph rather than a blank, so a run of
 * zeros still reads as a flat line and the chart never changes width.
 *
 * @param values - The series to draw, oldest first.
 * @param max - Optional scale ceiling; the series' own maximum is used when omitted or smaller.
 * @returns One glyph per value, or an empty string for no values.
 */
export function sparkline(values: readonly number[], max?: number): string {
  if (values.length === 0) {
    return '';
  }
  const ceiling = Math.max(max ?? 0, ...values, 1);
  return values
    .map((value) => {
      const level = Math.round((Math.max(0, value) / ceiling) * (BARS.length - 1));
      return BARS[Math.min(BARS.length - 1, level)] ?? '';
    })
    .join('');
}
