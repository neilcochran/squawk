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
            { navaidId: 'BOS', bearingDeg: 270, distanceNm: 14.6 } as never,
            { navaidId: 'JFK', bearingDeg: 90.4, distanceNm: 22.1 } as never,
          ],
        })}
      />,
    );
    expect(screen.getByText('Navaid associations (2)')).toBeInTheDocument();
    expect(screen.getByText('270 deg / 14.6 nm')).toBeInTheDocument();
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
