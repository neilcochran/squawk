import { describe, expect, it } from 'vitest';

import { formatStatsLines } from './stats.js';
import type { SessionStatsInfo } from './stats.js';

function makeInfo(overrides: Partial<SessionStatsInfo> = {}): SessionStatsInfo {
  return {
    startedAt: 0,
    nowMs: 0,
    aircraftCount: 0,
    peakAircraftCount: 0,
    uniqueAircraftCount: 0,
    messageCount: 0,
    messageRatePerSec: 0,
    rateHistory: [],
    maxDistance: undefined,
    hasLocation: false,
    units: 'aviation',
    ...overrides,
  };
}

describe('formatStatsLines', () => {
  it('reports uptime and the aircraft counts on the first line', () => {
    const lines = formatStatsLines(
      makeInfo({
        startedAt: 1000,
        nowMs: 1000 + 12 * 60 * 1000 + 34 * 1000,
        aircraftCount: 12,
        peakAircraftCount: 23,
        uniqueAircraftCount: 87,
      }),
    );

    expect(lines[0]).toBe('up 12m34s  |  aircraft: 12 now, peak 23, 87 unique');
  });

  it('reports message totals with average and peak over the rate window', () => {
    const lines = formatStatsLines(
      makeInfo({ messageCount: 4064, messageRatePerSec: 45, rateHistory: [30, 40, 61, 20] }),
    );

    expect(lines[1]).toBe('msgs: 4064 total  |  45/s now, 38/s avg, 61/s peak over last 4s');
  });

  it('says so before any rate sample exists, and draws no sparkline', () => {
    const lines = formatStatsLines(makeInfo({ messageCount: 3, messageRatePerSec: 3 }));

    expect(lines[1]).toBe('msgs: 3 total  |  3/s now, no rate samples yet');
    expect(lines.some((line) => line.startsWith('msgs/s:'))).toBe(false);
  });

  it('omits the distance line entirely without a location', () => {
    const lines = formatStatsLines(makeInfo({ hasLocation: false }));

    expect(lines.some((line) => line.startsWith('max distance'))).toBe(false);
  });

  it('shows a placeholder distance with a location but no record yet', () => {
    const lines = formatStatsLines(makeInfo({ hasLocation: true }));

    expect(lines).toContain('max distance: -');
  });

  it('names the aircraft that set the distance record, with its callsign when known', () => {
    const withCallsign = formatStatsLines(
      makeInfo({
        hasLocation: true,
        maxDistance: { icaoHex: 'A0B1C2', callsign: 'UAL123', distanceNm: 212.4 },
      }),
    );
    const withoutCallsign = formatStatsLines(
      makeInfo({
        hasLocation: true,
        maxDistance: { icaoHex: 'A0B1C2', callsign: undefined, distanceNm: 212.4 },
      }),
    );

    expect(withCallsign).toContain('max distance: 212nm (A0B1C2 UAL123)');
    expect(withoutCallsign).toContain('max distance: 212nm (A0B1C2)');
  });

  it('renders the max distance in metric when asked', () => {
    const lines = formatStatsLines(
      makeInfo({
        hasLocation: true,
        units: 'metric',
        maxDistance: { icaoHex: 'A0B1C2', callsign: undefined, distanceNm: 100 },
      }),
    );

    expect(lines).toContain('max distance: 185km (A0B1C2)');
  });

  it('ends with a sparkline of the rate window when there are samples', () => {
    const lines = formatStatsLines(makeInfo({ rateHistory: [1, 2, 3] }));
    const last = lines[lines.length - 1] ?? '';

    expect(last.startsWith('msgs/s: ')).toBe(true);
    expect([...last.slice('msgs/s: '.length)]).toHaveLength(3);
  });
});
