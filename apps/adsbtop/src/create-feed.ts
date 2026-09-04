import {
  createBeastAircraftFeed,
  createJsonAircraftFeed,
  createSbsAircraftFeed,
} from '@squawk/adsb-feed';
import type { AircraftFeed } from '@squawk/adsb-feed';

import type { CliOptions } from './cli-args.js';

/** The three feed factories `buildFeed` chooses between, injectable so tests can substitute fakes without touching real sockets/HTTP. */
export interface FeedFactories {
  /** Factory for the `json` source. */
  createJsonAircraftFeed: typeof createJsonAircraftFeed;
  /** Factory for the `sbs` source. */
  createSbsAircraftFeed: typeof createSbsAircraftFeed;
  /** Factory for the `beast` source. */
  createBeastAircraftFeed: typeof createBeastAircraftFeed;
}

/** The real `@squawk/adsb-feed` factories, used outside of tests. */
export const DEFAULT_FEED_FACTORIES: FeedFactories = {
  createJsonAircraftFeed,
  createSbsAircraftFeed,
  createBeastAircraftFeed,
};

/**
 * Builds the `aircraft.json` URL for the `json` source from `--host`/`--port`,
 * used unless `--url` was passed explicitly.
 *
 * @param host - Station hostname or IP address.
 * @param port - HTTP port serving `aircraft.json`.
 * @returns The full endpoint URL.
 */
export function buildJsonUrl(host: string, port: number): string {
  return `http://${host}:${port}/data/aircraft.json`;
}

/**
 * Constructs the `AircraftFeed` for the CLI's selected source and connection
 * options.
 *
 * @param cli - Parsed, validated CLI options (must have `help: false`).
 * @param factories - Feed factories to use; defaults to the real `@squawk/adsb-feed` factories.
 * @returns An `AircraftFeed` ready to `start()`.
 */
export function buildFeed(
  cli: CliOptions,
  factories: FeedFactories = DEFAULT_FEED_FACTORIES,
): AircraftFeed {
  switch (cli.source) {
    case 'json':
      return factories.createJsonAircraftFeed({ url: cli.url ?? buildJsonUrl(cli.host, cli.port) });
    case 'sbs':
      return factories.createSbsAircraftFeed({ host: cli.host, port: cli.port });
    case 'beast':
      return factories.createBeastAircraftFeed({ host: cli.host, port: cli.port });
  }
}
