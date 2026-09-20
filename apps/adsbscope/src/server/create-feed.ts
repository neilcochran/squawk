import { basename } from 'node:path';

import { createAircraftFeedForSource } from '@squawk/adsb-feed';
import type { AircraftFeed, PositionHistoryRetention } from '@squawk/adsb-feed';

import type { CliOptions } from './cli-args.js';
import { createReplayAircraftFeed, openRecordingLines } from './replay-feed.js';

/**
 * How much position history the feed keeps per aircraft. The scope only
 * draws a short trail behind each target, so two minutes is plenty, and
 * bounding it keeps a long-running session's memory flat.
 */
export const POSITION_HISTORY_RETENTION: PositionHistoryRetention = { maxAgeMs: 120_000 };

/** The feed factories `buildFeed` chooses between, injectable so tests can substitute fakes without touching real sockets, HTTP, or files. */
export interface FeedFactories {
  /** Factory for a live station feed. */
  createLiveFeed: typeof createAircraftFeedForSource;
  /** Factory for a replayed recording. */
  createReplayFeed: typeof createReplayAircraftFeed;
}

/** The real factories, used outside of tests. */
export const DEFAULT_FEED_FACTORIES: FeedFactories = {
  createLiveFeed: createAircraftFeedForSource,
  createReplayFeed: createReplayAircraftFeed,
};

/**
 * Constructs the `AircraftFeed` for the CLI's options: a replay of
 * `--replay`'s recording when given, otherwise a live feed for the selected
 * source. Position history is bounded by {@link POSITION_HISTORY_RETENTION}
 * either way, and the receiver location doubles as the Beast source's
 * reference position.
 *
 * @param cli - Parsed, validated CLI options (must have `help: false`).
 * @param factories - Feed factories to use; defaults to the real ones.
 * @returns An `AircraftFeed` ready to `start()`.
 */
export function buildFeed(
  cli: CliOptions,
  factories: FeedFactories = DEFAULT_FEED_FACTORIES,
): AircraftFeed {
  if (cli.replayPath !== undefined) {
    return factories.createReplayFeed({
      openLines: openRecordingLines(cli.replayPath),
      positionHistoryRetention: POSITION_HISTORY_RETENTION,
    });
  }
  return factories.createLiveFeed({
    source: cli.source,
    host: cli.host,
    port: cli.port,
    staleAfterMs: cli.staleAfterMs,
    positionHistoryRetention: POSITION_HISTORY_RETENTION,
    receiverPosition: cli.location,
    ...(cli.url !== undefined && { url: cli.url }),
  });
}

/**
 * Describes where the traffic comes from, for the UI's status bar.
 *
 * @param cli - Parsed, validated CLI options.
 * @returns The replay file's name, the `aircraft.json` URL, or `host:port`.
 */
export function describeStation(cli: CliOptions): string {
  if (cli.replayPath !== undefined) {
    return basename(cli.replayPath);
  }
  return cli.url ?? `${cli.host}:${cli.port}`;
}
