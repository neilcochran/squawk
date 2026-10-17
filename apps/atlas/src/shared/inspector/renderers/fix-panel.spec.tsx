import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Fix } from '@squawk/types';

import { FixPanel } from './fix-panel.tsx';

const { useFixAssociationSelectionsMock } = vi.hoisted(() => ({
  useFixAssociationSelectionsMock: vi.fn<(fix: Fix) => ReadonlyArray<string | undefined>>(),
}));

vi.mock('../fix-association-selection.ts', () => ({
  useFixAssociationSelections: useFixAssociationSelectionsMock,
}));

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
  beforeEach(() => {
    useFixAssociationSelectionsMock.mockImplementation((fix) =>
      fix.navaidAssociations.map(() => undefined),
    );
  });

  it('links a navaid association row to its navaid and leaves an unlinkable row plain', () => {
    const onSelectEntity = vi.fn<(selection: string) => void>();
    useFixAssociationSelectionsMock.mockReturnValue([undefined, 'navaid:TOY']);
    render(
      <FixPanel
        record={buildFix({
          navaidAssociations: [
            { navaidId: 'CPS', navaidType: 'LOC', magneticBearingDeg: 122.22 },
            { navaidId: 'TOY', navaidType: 'VORTAC', magneticBearingDeg: 202.71 },
          ],
        })}
        onSelectEntity={onSelectEntity}
      />,
    );
    expect(screen.queryByRole('button', { name: 'CPS LOC' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'TOY VORTAC' }));
    expect(onSelectEntity).toHaveBeenCalledWith('navaid:TOY');
  });

  it('leaves every association row plain without a selection handler', () => {
    useFixAssociationSelectionsMock.mockReturnValue(['navaid:TOY']);
    render(
      <FixPanel
        record={buildFix({
          navaidAssociations: [{ navaidId: 'TOY', navaidType: 'VORTAC', magneticBearingDeg: 202 }],
        })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'TOY VORTAC' })).toBeNull();
    expect(screen.getByText('TOY VORTAC')).toBeInTheDocument();
  });

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
    expect(screen.getByText('BOS VOR/DME').closest('div')).toHaveTextContent('270 deg M / 14.6 nm');
  });

  it('labels each row with the facility type so a localizer and its marker read apart', () => {
    render(
      <FixPanel
        record={buildFix({
          navaidAssociations: [
            { navaidId: 'CPS', navaidType: 'LOC', magneticBearingDeg: 122.22 },
            { navaidId: 'CPS', navaidType: 'OM' },
          ],
        })}
      />,
    );
    expect(screen.getByText('CPS LOC').closest('div')).toHaveTextContent('122 deg M');
    expect(screen.getByText('CPS OM').closest('div')).toHaveTextContent(/^CPS OM-$/);
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
    expect(screen.getByText('122 deg M')).toBeInTheDocument();
    expect(screen.getByText('1.8 nm')).toBeInTheDocument();
    expect(screen.getByText('RHI OM').closest('div')).toHaveTextContent(/^RHI OM-$/);
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
