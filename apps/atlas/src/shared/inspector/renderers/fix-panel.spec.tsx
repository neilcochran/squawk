import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { Fix } from '@squawk/types';

import { FixPanel } from './fix-panel.tsx';

function buildFix(overrides: Partial<Fix> = {}): Fix {
  return {
    identifier: 'MERIT',
    icaoRegionCode: 'K6',
    country: 'US',
    lat: 0,
    lon: 0,
    useCode: 'WP',
    pitch: false,
    catch: false,
    suaAtcaa: false,
    chartTypes: [],
    navaidAssociations: [],
    ...overrides,
  } as Fix;
}

describe('FixPanel', () => {
  it('renders classification and location rows for a minimal fix', () => {
    render(<FixPanel record={buildFix()} />);
    expect(screen.getByText('Classification')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Waypoint')).toBeInTheDocument();
  });

  it('renders chart types as a comma-joined list when present', () => {
    render(<FixPanel record={buildFix({ chartTypes: ['ENROUTE LOW', 'ENROUTE HIGH'] })} />);
    expect(screen.getByText('ENROUTE LOW, ENROUTE HIGH')).toBeInTheDocument();
  });

  it('renders MRA in feet when set', () => {
    render(<FixPanel record={buildFix({ minimumReceptionAltitudeFt: 5000 })} />);
    expect(screen.getByText('5000 ft')).toBeInTheDocument();
  });

  it('renders navaid associations when present', () => {
    render(
      <FixPanel
        record={buildFix({
          navaidAssociations: [
            { navaidId: 'BOS', navaidType: 'VOR/DME', magneticBearingDeg: 270, distanceNm: 14.6 },
            { navaidId: 'JFK', navaidType: 'VOR/DME', magneticBearingDeg: 90.4, distanceNm: 22.1 },
          ],
        })}
      />,
    );
    expect(screen.getByText('Navaid associations (2)')).toBeInTheDocument();
    expect(screen.getByText('270 deg / 14.6 nm')).toBeInTheDocument();
  });

  it('renders an association that publishes only a bearing, only a distance, or neither', () => {
    render(
      <FixPanel
        record={buildFix({
          navaidAssociations: [
            { navaidId: 'CPS', navaidType: 'LOC', magneticBearingDeg: 122.22 },
            { navaidId: 'CZF', navaidType: 'DME', distanceNm: 1.8 },
            { navaidId: 'RHI', navaidType: 'OM' },
          ],
        })}
      />,
    );
    expect(screen.getByText('Navaid associations (3)')).toBeInTheDocument();
    expect(screen.getByText('122 deg')).toBeInTheDocument();
    expect(screen.getByText('1.8 nm')).toBeInTheDocument();
    expect(screen.getByText('OM')).toBeInTheDocument();
  });

  it('omits the navaid associations section when empty', () => {
    render(<FixPanel record={buildFix()} />);
    expect(screen.queryByText(/Navaid associations/)).toBeNull();
  });

  it('renders the chartingRemark section when set', () => {
    render(<FixPanel record={buildFix({ chartingRemark: 'NORTH OF KORD' })} />);
    expect(screen.getByText('Remark')).toBeInTheDocument();
    expect(screen.getByText('NORTH OF KORD')).toBeInTheDocument();
  });

  it('omits the chartingRemark section when undefined', () => {
    render(<FixPanel record={buildFix()} />);
    expect(screen.queryByText('Remark')).toBeNull();
  });
});
