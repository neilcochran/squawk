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
            { id: '04L/22R', lengthFt: 7000, widthFt: 150, surfaceType: 'ASPH' } as never,
            { id: '15R/33L', lengthFt: 10005, widthFt: 150, surfaceType: 'CONC' } as never,
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
            { use: 'TWR', frequencyMhz: 119.1 } as never,
            { use: 'GND', frequencyMhz: 121.9 } as never,
          ],
        })}
      />,
    );
    expect(screen.getByText('Frequencies (2)')).toBeInTheDocument();
    expect(screen.getByText('119.10 MHz')).toBeInTheDocument();
  });

  it('omits the Frequencies section when none are present', () => {
    render(<AirportPanel record={buildAirport()} />);
    expect(screen.queryByText(/^Frequencies/)).toBeNull();
  });
});
