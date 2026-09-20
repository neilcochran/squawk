import type { ScopeSnapshot } from '../../shared/protocol.js';
import type { StreamState } from '../data/use-scope-stream.js';

/**
 * The health of the chain from station to browser: data flowing, still
 * starting up, the server has lost the station, or the browser has lost the
 * server.
 */
export type LinkStatus = 'live' | 'connecting' | 'stationReconnecting' | 'serverLost';

/** The label shown for each {@link LinkStatus}. */
export const LINK_STATUS_LABELS: Record<LinkStatus, string> = {
  live: 'LIVE',
  connecting: 'CONNECTING',
  stationReconnecting: 'STATION RECONNECTING',
  serverLost: 'NO LINK TO SERVER',
};

/**
 * Resolves the health of the two links in the chain, worst first: the
 * browser's link to the scope server, then the server's link to the station.
 *
 * @param streamState - The browser's link to the scope server.
 * @param snapshot - The most recent snapshot, if any.
 * @returns The link status.
 */
export function resolveLinkStatus(
  streamState: StreamState,
  snapshot: ScopeSnapshot | undefined,
): LinkStatus {
  if (streamState === 'lost') {
    return 'serverLost';
  }
  if (streamState === 'connecting' || snapshot === undefined) {
    return 'connecting';
  }
  return snapshot.connection === 'connected' ? 'live' : 'stationReconnecting';
}

/**
 * Whether a link status is the healthy one, which decides how it is styled.
 *
 * @param status - The link status.
 * @returns True only when data is flowing end to end.
 */
export function isLinkHealthy(status: LinkStatus): boolean {
  return status === 'live';
}

/**
 * Counts the tracked targets, and how many of them have a position to plot.
 *
 * @param snapshot - The most recent snapshot, if any.
 * @returns A label such as `23 targets (19 plotted)`.
 */
export function formatTargetCount(snapshot: ScopeSnapshot | undefined): string {
  const targets = snapshot?.targets ?? [];
  const plotted = targets.filter((target) => target.position !== undefined).length;
  return `${targets.length} targets (${plotted} plotted)`;
}
