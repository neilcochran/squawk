import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { Navaid } from '@squawk/types';

import { NavaidPanel } from './navaid-panel.tsx';

function buildNavaid(overrides: Partial<Navaid> = {}): Navaid {
  return {
    identifier: 'ACK',
    name: 'NANTUCKET',
    type: 'VOR/DME',
    status: 'OPERATIONAL_RESTRICTED',
    lat: 41.28,
    lon: -70.03,
    country: 'US',
    frequencyMhz: 116.2,
    ...overrides,
  };
}

describe('NavaidPanel', () => {
  it('shows the DME status beside the facility status when the FAA publishes one', () => {
    render(<NavaidPanel record={buildNavaid({ dmeStatus: 'OPERATIONAL_IFR' })} />);
    expect(screen.getByText('Operational (restricted)')).toBeInTheDocument();
    expect(screen.getByText('DME status').closest('div')).toHaveTextContent('Operational (IFR)');
  });

  it('omits the DME status row when none is published', () => {
    render(<NavaidPanel record={buildNavaid()} />);
    expect(screen.queryByText('DME status')).toBeNull();
  });

  it('lists each FAA remark as its own paragraph', () => {
    render(
      <NavaidPanel
        record={buildNavaid({
          remarks: ['VOR UNUSBL 163-236 BYD 40 NM BLW 18000 FT.', 'DME UNUSBL 270-290 BYD 10 NM.'],
        })}
      />,
    );
    expect(screen.getByText('Remarks')).toBeInTheDocument();
    expect(screen.getByText('VOR UNUSBL 163-236 BYD 40 NM BLW 18000 FT.')).toBeInTheDocument();
    expect(screen.getByText('DME UNUSBL 270-290 BYD 10 NM.')).toBeInTheDocument();
  });

  it('omits the remarks section when there are none', () => {
    render(<NavaidPanel record={buildNavaid({ remarks: [] })} />);
    expect(screen.queryByText('Remarks')).toBeNull();
  });

  it('lists VOR checkpoints with the radial, where they are used and the FAA description', () => {
    render(
      <NavaidPanel
        record={buildNavaid({
          checkpoints: [
            {
              type: 'GROUND',
              magneticBearingDeg: 133,
              airportId: 'CHS',
              description: '0.3 NM AT RUNUP AREA RWY 33.',
            },
            {
              type: 'AIRBORNE',
              magneticBearingDeg: 90,
              altitudeFt: 3000,
              description: 'OVER WATER TOWER.',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('VOR checkpoints (2)')).toBeInTheDocument();
    const ground = screen.getByText('CHS').closest('div');
    expect(ground).toHaveTextContent('R-133, ground');
    expect(ground).toHaveTextContent('0.3 NM AT RUNUP AREA RWY 33.');
    const airborne = screen.getByText('Airborne').closest('div');
    expect(airborne).toHaveTextContent('R-090, airborne at 3000 ft MSL');
  });

  it('omits the checkpoints section when the navaid has none', () => {
    render(<NavaidPanel record={buildNavaid()} />);
    expect(screen.queryByText(/VOR checkpoints/)).toBeNull();
  });
});
