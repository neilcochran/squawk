import { createAircraftFeedForSource } from '@squawk/adsb-feed';
import type { AircraftFeed, PositionHistoryRetention } from '@squawk/adsb-feed';

import type { CliOptions } from './cli-args.js';

/**
 * How much position history the feed keeps per aircraft. adsbtop does not
 * read the history yet, but the feed retains it regardless and without a
 * bound would keep every position for every aircraft for the whole
 * session. A few hundred entries (about five minutes at one position per
 * second) leaves plenty for a future trail or sparkline while keeping a
 * long-running session's memory flat.
 */
export const POSITION_HISTORY_RETENTION: PositionHistoryRetention = { maxEntries: 300 };

/**
 * Constructs the `AircraftFeed` for the CLI's selected source and connection
 * options. The stale threshold is always passed explicitly, so what the
 * table dims against is exactly what the feed drops against. The feed's
 * default one-second staleness sweep means a drop lands within a second of
 * that threshold. Position history is bounded by
 * {@link POSITION_HISTORY_RETENTION} for every source, and the configured
 * location doubles as the Beast source's receiver position.
 *
 * @param cli - Parsed, validated CLI options (must have `help: false`).
 * @param createFeed - Feed factory to use; defaults to the real `@squawk/adsb-feed` factory, injectable so tests can substitute a fake without touching real sockets/HTTP.
 * @returns An `AircraftFeed` ready to `start()`.
 */
export function buildFeed(
  cli: CliOptions,
  createFeed: typeof createAircraftFeedForSource = createAircraftFeedForSource,
): AircraftFeed {
  return createFeed({
    source: cli.source,
    host: cli.host,
    port: cli.port,
    staleAfterMs: cli.staleAfterMs,
    positionHistoryRetention: POSITION_HISTORY_RETENTION,
    ...(cli.url !== undefined && { url: cli.url }),
    ...(cli.location !== undefined && { receiverPosition: cli.location }),
  });
}
