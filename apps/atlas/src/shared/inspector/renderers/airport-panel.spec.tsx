import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { Airport } from '@squawk/types';

import { AirportPanel } from './airport-panel.tsx';

function buildAirport(overrides: Partial<Airport> = {}): Airport {
  return {
    faaId: 'BOS',
    icao: 'KBOS',
    name: 'BOSTON LOGAN',
    facilityType: 'AIRPORT',
    ownershipType: 'PUBLIC',
    useType: 'PUBLIC',
    status: 'OPEN',
    city: 'BOSTON',
    state: 'MA',
    country: 'US',
    lat: 0,
    lon: 0,
    timezone: 'America/New_York',
    runways: [],
    frequencies: [],
    ...overrides,
  } as Airport;
}

describe('AirportPanel', () => {
  it('renders the Location and Facility sections for a minimal record', () => {
    render(<AirportPanel record={buildAirport()} />);
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Facility')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('renders the elevation in feet MSL when set', () => {
    render(<AirportPanel record={buildAirport({ elevationFt: 19 })} />);
    expect(screen.getByText('19 ft MSL')).toBeInTheDocument();
  });

  it('renders Private when useType is not PUBLIC', () => {
    render(<AirportPanel record={buildAirport({ useType: 'PRIVATE' as never })} />);
    expect(screen.getByText('Private')).toBeInTheDocument();
  });

  it('renders the Runways section when at least one runway is present', () => {
    render(
      <AirportPanel
        record={buildAirport({
          runways: [
            { id: '04L/22R', lengthFt: 7000, widthFt: 150, surfaceType: 'ASPH', ends: [] },
            { id: '15R/33L', lengthFt: 10005, widthFt: 150, surfaceType: 'CONC', ends: [] },
          ],
        })}
      />,
    );
    expect(screen.getByText('Runways (2)')).toBeInTheDocument();
    expect(screen.getByText('04L/22R')).toBeInTheDocument();
  });

  it('omits the Runways section when none are present', () => {
    render(<AirportPanel record={buildAirport()} />);
    expect(screen.queryByText(/^Runways/)).toBeNull();
  });

  it('renders the Frequencies section when at least one is present', () => {
    render(
      <AirportPanel
        record={buildAirport({
          frequencies: [
            { use: 'TWR', frequencyMhz: 119.1 },
            { use: 'GND', frequencyMhz: 121.9 },
          ],
        })}
      />,
    );
    expect(screen.getByText('Frequencies (2)')).toBeInTheDocument();
    expect(screen.getByText('119.10 MHz')).toBeInTheDocument();
  });

  it('stacks the pavement rating and the RVR sites under the runway dimensions', () => {
    render(
      <AirportPanel
        record={buildAirport({
          runways: [
            {
              id: '04L/22R',
              lengthFt: 12079,
              widthFt: 200,
              surfaceType: 'ASPH-CONC',
              pavementClassification: {
                system: 'PCR',
                value: 1260,
                pavementType: 'RIGID',
                subgradeStrength: 'B',
                tirePressure: 'W',
                evaluationMethod: 'TECHNICAL',
              },
              ends: [
                { id: '04L', rvrLocations: ['TOUCHDOWN', 'ROLLOUT'] },
                { id: '22R', rvrLocations: ['TOUCHDOWN', 'MIDPOINT', 'ROLLOUT'] },
              ],
            },
          ],
        })}
      />,
    );
    const row = screen.getByText('04L/22R').closest('div');
    expect(row).toHaveTextContent('12079 x 200 ft, ASPH-CONC');
    expect(row).toHaveTextContent('PCR 1260 R/B/W/T');
    expect(row).toHaveTextContent('04L RVR-TR, 22R RVR-TMR');
  });

  it('details a frequency with its qualifier, sectorization, outside provider and remark', () => {
    render(
      <AirportPanel
        record={buildAirport({
          frequencies: [
            {
              use: 'CD/P',
              frequencyMhz: 121.725,
              sectorization: 'RWY 04R/22L',
              provider: 'BHM',
              providerType: 'ATCT-TRACON',
              remark: 'GCO AVBL ON FREQ 121.725.',
            },
            {
              use: 'BOS RCO',
              frequencyMhz: 122.1,
              receiveOnly: true,
              provider: 'BOS',
              providerType: 'RCO',
              callSign: 'BOSTON',
            },
          ],
        })}
      />,
    );
    const clearance = screen.getByText('CD/P').closest('div');
    expect(clearance).toHaveTextContent('121.725 MHz');
    expect(clearance).toHaveTextContent('RWY 04R/22L');
    expect(clearance).toHaveTextContent('via BHM tower & TRACON');
    expect(clearance).toHaveTextContent('GCO AVBL ON FREQ 121.725.');
    // The airport's own facility is not repeated as a provider line.
    const rco = screen.getByText('BOS RCO').closest('div');
    expect(rco).toHaveTextContent('122.10 MHz, receive only');
    expect(rco).not.toHaveTextContent('via');
  });

  it('shows the tower and approach call signs and the pattern altitude in the facility section', () => {
    render(
      <AirportPanel
        record={buildAirport({
          trafficPatternAltitudeFtAgl: 1000,
          frequencies: [
            {
              use: 'LCL/P',
              frequencyMhz: 119.1,
              provider: 'BOS',
              providerType: 'ATCT-TRACON',
              callSign: 'BOSTON',
              approachCallSign: 'BOSTON',
            },
          ],
        })}
      />,
    );
    expect(screen.getByText('Tower call sign').closest('div')).toHaveTextContent('BOSTON');
    expect(screen.getByText('Approach').closest('div')).toHaveTextContent('BOSTON');
    expect(screen.getByText('Pattern altitude').closest('div')).toHaveTextContent('1000 ft AGL');
  });

  it('omits the Frequencies section when none are present', () => {
    render(<AirportPanel record={buildAirport()} />);
    expect(screen.queryByText(/^Frequencies/)).toBeNull();
  });
});
