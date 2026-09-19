import type { FeedSource } from './types/index.js';

/**
 * Default port per {@link FeedSource}, matching dump1090-fa's own defaults:
 * the HTTP server for `aircraft.json`, the SBS/BaseStation TCP output, and
 * the Beast binary TCP output.
 */
export const DEFAULT_PORT_BY_SOURCE: Record<FeedSource, number> = {
  json: 8080,
  sbs: 30003,
  beast: 30005,
};
