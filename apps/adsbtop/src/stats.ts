import { formatDistance, formatDuration } from './format.js';
import { sparkline } from './sparkline.js';

/** The farthest aircraft observed this session, for the stats panel. */
export interface MaxDistanceRecord {
  /** ICAO hex of the aircraft that set the record. */
  icaoHex: string;
  /** Its callsign at the time, if known. */
  callsign: string | undefined;
  /** Great-circle distance from the receiver in nautical miles. */
  distanceNm: number;
}

/** Inputs for {@link formatStatsLines}. */
export interface SessionStatsInfo {
  /** Unix epoch ms adsbtop started. */
  startedAt: number;
  /** Current time, for the session duration. */
  nowMs: number;
  /** Aircraft tracked right now. */
  aircraftCount: number;
  /** Most aircraft tracked at once this session. */
  peakAircraftCount: number;
  /** Distinct ICAO hexes seen this session, including ones since lost. */
  uniqueAircraftCount: number;
  /** Total update events since start. */
  messageCount: number;
  /** Update events in roughly the last second. */
  messageRatePerSec: number;
  /** Per-second message rates, oldest first, over the recent window. */
  rateHistory: readonly number[];
  /** The farthest aircraft seen, when a receiver location is configured. */
  maxDistance: MaxDistanceRecord | undefined;
  /** Whether a receiver location is configured - decides whether the distance line appears at all. */
  hasLocation: boolean;
}

/**
 * Builds the stats panel's lines. A pure string builder, kept separate
 * from the Ink component so it is directly unit-testable: session uptime
 * and aircraft counts; message totals and rates, with the average and peak
 * over the recent rate window; the farthest aircraft (only when a location
 * is configured, since it cannot be computed otherwise); and a sparkline
 * of the rate window when there are samples to draw.
 *
 * @param info - The session figures.
 * @returns The lines in display order, without styling.
 */
export function formatStatsLines(info: SessionStatsInfo): string[] {
  const uptime = formatDuration(Math.max(0, Math.floor((info.nowMs - info.startedAt) / 1000)));
  const lines = [
    `up ${uptime}  |  aircraft: ${info.aircraftCount} now, peak ${info.peakAircraftCount}, ${info.uniqueAircraftCount} unique`,
  ];

  if (info.rateHistory.length === 0) {
    lines.push(
      `msgs: ${info.messageCount} total  |  ${info.messageRatePerSec}/s now, no rate samples yet`,
    );
  } else {
    const total = info.rateHistory.reduce((sum, rate) => sum + rate, 0);
    const average = Math.round(total / info.rateHistory.length);
    const peak = Math.max(...info.rateHistory);
    lines.push(
      `msgs: ${info.messageCount} total  |  ${info.messageRatePerSec}/s now, ${average}/s avg, ${peak}/s peak over last ${info.rateHistory.length}s`,
    );
  }

  if (info.hasLocation) {
    if (info.maxDistance === undefined) {
      lines.push('max distance: -');
    } else {
      const who = [info.maxDistance.icaoHex, info.maxDistance.callsign]
        .filter((part) => part !== undefined)
        .join(' ');
      lines.push(`max distance: ${formatDistance(info.maxDistance.distanceNm)} (${who})`);
    }
  }

  if (info.rateHistory.length > 0) {
    lines.push(`msgs/s: ${sparkline(info.rateHistory)}`);
  }

  return lines;
}
