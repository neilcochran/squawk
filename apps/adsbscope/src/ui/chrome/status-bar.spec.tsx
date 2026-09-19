// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { APP_NAME } from '../../shared/protocol.js';
import type { ScopeConfig } from '../../shared/protocol.js';
import { makeSnapshot, makeTarget } from '../scope/test-utils.js';

import { LINK_STATUS_LABELS } from './link-status.js';
import { StatusBar } from './status-bar.js';

const CONFIG: ScopeConfig = {
  receiver: { lat: 40.6413, lon: -73.7781 },
  source: 'beast',
  station: '192.168.1.50:30005',
  rangeNm: 60,
};

describe('StatusBar', () => {
  it('shows the app name, source, station, link status, target count, and range', () => {
    const snapshot = makeSnapshot([makeTarget({ position: { trueBearingDeg: 0, rangeNm: 5 } })]);

    render(<StatusBar config={CONFIG} streamState="open" snapshot={snapshot} rangeNm={40} />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(APP_NAME);
    expect(status).toHaveTextContent('beast 192.168.1.50:30005');
    expect(status).toHaveTextContent(LINK_STATUS_LABELS.live);
    expect(status).toHaveTextContent('1 targets (1 plotted)');
    expect(status).toHaveTextContent('range 40 nm');
  });

  it('shows the label for each link status', () => {
    const view = render(
      <StatusBar config={CONFIG} streamState="lost" snapshot={undefined} rangeNm={60} />,
    );
    expect(screen.getByText(LINK_STATUS_LABELS.serverLost)).toBeInTheDocument();

    view.rerender(
      <StatusBar config={CONFIG} streamState="connecting" snapshot={undefined} rangeNm={60} />,
    );
    expect(screen.getByText(LINK_STATUS_LABELS.connecting)).toBeInTheDocument();

    view.rerender(
      <StatusBar
        config={CONFIG}
        streamState="open"
        snapshot={makeSnapshot([], { connection: 'reconnecting' })}
        rangeNm={60}
      />,
    );
    expect(screen.getByText(LINK_STATUS_LABELS.stationReconnecting)).toBeInTheDocument();
  });

  it('styles a healthy status differently from one that needs attention', () => {
    const view = render(
      <StatusBar config={CONFIG} streamState="open" snapshot={makeSnapshot()} rangeNm={60} />,
    );
    const healthyClass = screen.getByText(LINK_STATUS_LABELS.live).className;

    view.rerender(
      <StatusBar config={CONFIG} streamState="lost" snapshot={undefined} rangeNm={60} />,
    );

    expect(screen.getByText(LINK_STATUS_LABELS.serverLost).className).not.toBe(healthyClass);
  });
});
