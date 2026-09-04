import type { FeedSource } from './cli-args.js';
import { formatAge } from './format.js';

/** Inputs for {@link formatStatusLine}. */
export interface StatusLineInfo {
  /** Feed source currently in use. */
  source: FeedSource;
  /** Station host being connected to. */
  host: string;
  /** Station port being connected to. */
  port: number;
  /** Number of aircraft currently tracked. */
  aircraftCount: number;
  /** Update events observed in roughly the last second. */
  messageRatePerSec: number;
  /** Unix epoch ms of the most recent update, or undefined if none has arrived yet. */
  lastMessageAt: number | undefined;
  /** Current time, for the "last update" age. */
  nowMs: number;
}

/**
 * Builds the single-line connection/activity summary shown in the status
 * header. A pure string builder, kept separate from the Ink component so it
 * is directly unit-testable without a render harness.
 *
 * @param info - The connection and activity state to summarize.
 * @returns The formatted status line, without any styling applied.
 */
export function formatStatusLine(info: StatusLineInfo): string {
  const lastUpdate =
    info.lastMessageAt === undefined
      ? 'none yet'
      : `${formatAge(info.lastMessageAt, info.nowMs)} ago`;
  return (
    `source: ${info.source} ${info.host}:${info.port}  |  ` +
    `aircraft: ${info.aircraftCount}  |  ` +
    `msgs/s: ${info.messageRatePerSec}  |  ` +
    `last update: ${lastUpdate}`
  );
}
