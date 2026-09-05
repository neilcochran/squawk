import type { PositionHistoryEntry } from '@squawk/adsb-feed';

/** Unicode block characters from shortest to tallest, one per sparkline level. */
const SPARKLINE_LEVELS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

/**
 * Maximum samples rendered, most recent first truncated from the front of
 * `history`. A sparkline is a fixed-size recent-trend glyph, not a full
 * session dump - without this cap the line grows by one character per
 * position update for as long as an aircraft stays tracked, eventually
 * overflowing the terminal width and wrapping.
 */
const MAX_SPARKLINE_SAMPLES = 60;

/**
 * Builds a single-line altitude sparkline from a position history, oldest
 * sample first. Barometric altitude is preferred per sample, geometric as a
 * fallback - matching the table's altitude column precedence. Samples with
 * neither field are skipped rather than breaking the line. Only the most
 * recent {@link MAX_SPARKLINE_SAMPLES} are rendered.
 *
 * @param history - Position samples for one aircraft, oldest first (as returned by `AircraftFeed.getPositionHistory`).
 * @returns A string of block characters scaled between the shown window's min and max altitude, or an empty string if no sample carries an altitude.
 */
export function buildAltitudeSparkline(history: readonly PositionHistoryEntry[]): string {
  const recent = history.slice(-MAX_SPARKLINE_SAMPLES);
  const altitudes = recent
    .map((entry) => entry.position.baroAltitudeFt ?? entry.position.geoAltitudeFt)
    .filter((altitude): altitude is number => altitude !== undefined);

  if (altitudes.length === 0) {
    return '';
  }

  const min = Math.min(...altitudes);
  const max = Math.max(...altitudes);
  if (min === max) {
    const midLevel = SPARKLINE_LEVELS[Math.floor(SPARKLINE_LEVELS.length / 2)] ?? '';
    return midLevel.repeat(altitudes.length);
  }

  return altitudes
    .map((altitude) => {
      const ratio = (altitude - min) / (max - min);
      const level = Math.min(
        SPARKLINE_LEVELS.length - 1,
        Math.floor(ratio * SPARKLINE_LEVELS.length),
      );
      return SPARKLINE_LEVELS[level];
    })
    .join('');
}
