import { describe, expect, it } from 'vitest';

import { makeSnapshot, makeTarget } from '../scope/test-utils.js';

import {
  formatTargetCount,
  isLinkHealthy,
  LINK_STATUS_LABELS,
  resolveLinkStatus,
} from './link-status.js';
import type { LinkStatus } from './link-status.js';

describe('resolveLinkStatus', () => {
  it('reports a dropped link to the server ahead of anything else', () => {
    expect(resolveLinkStatus('lost', makeSnapshot())).toBe('serverLost');
  });

  it('reports connecting until the stream is open and a snapshot has arrived', () => {
    expect(resolveLinkStatus('connecting', undefined)).toBe('connecting');
    expect(resolveLinkStatus('connecting', makeSnapshot())).toBe('connecting');
    expect(resolveLinkStatus('open', undefined)).toBe('connecting');
  });

  it("reports the station's own connection state once data is flowing", () => {
    expect(resolveLinkStatus('open', makeSnapshot())).toBe('live');
    expect(resolveLinkStatus('open', makeSnapshot([], { connection: 'reconnecting' }))).toBe(
      'stationReconnecting',
    );
  });
});

describe('isLinkHealthy', () => {
  it('is true only when data is flowing end to end', () => {
    const statuses: LinkStatus[] = ['live', 'connecting', 'stationReconnecting', 'serverLost'];

    expect(statuses.filter(isLinkHealthy)).toEqual(['live']);
  });
});

describe('LINK_STATUS_LABELS', () => {
  it('has a distinct, non-empty label for every status', () => {
    const labels = Object.values(LINK_STATUS_LABELS);

    expect(labels.every((label) => label !== '')).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('formatTargetCount', () => {
  it('counts all targets and those with a position', () => {
    const snapshot = makeSnapshot([
      makeTarget({ position: { trueBearingDeg: 0, rangeNm: 10 } }),
      makeTarget({ icaoHex: 'c0ffee' }),
    ]);

    expect(formatTargetCount(snapshot)).toBe('2 targets (1 plotted)');
  });

  it('reports zero before the first snapshot', () => {
    expect(formatTargetCount(undefined)).toBe('0 targets (0 plotted)');
  });
});
