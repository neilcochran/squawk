import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Airport, Airway, AirspaceFeature, Fix, Navaid } from '@squawk/types';
import { EntityInspector } from './inspector.tsx';

const { useSearchMock, useNavigateMock, navigateMock, useResolvedEntityMock } = vi.hoisted(() => ({
  useSearchMock: vi.fn(),
  useNavigateMock: vi.fn(),
  navigateMock: vi.fn(),
  useResolvedEntityMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: useSearchMock }),
  useNavigate: useNavigateMock,
}));

vi.mock('./entity-resolver.ts', () => ({
  useResolvedEntity: useResolvedEntityMock,
}));

const sampleAirport: Airport = {
  faaId: 'BOS',
  icao: 'KBOS',
  name: 'GENERAL EDWARD LAWRENCE LOGAN INTL',
  facilityType: 'AIRPORT',
  ownershipType: 'PUBLIC',
  useType: 'PUBLIC',
  status: 'OPEN',
  city: 'BOSTON',
  state: 'MA',
  country: 'US',
  lat: 42.3643,
  lon: -71.0052,
  timezone: 'America/New_York',
  elevationFt: 20,
  runways: [{ id: '04L/22R', lengthFt: 7864, widthFt: 150, surfaceType: 'CONC', ends: [] }],
  frequencies: [{ frequencyMhz: 119.1, use: 'TWR' }],
};

const sampleNavaid: Navaid = {
  identifier: 'BOS',
  name: 'BOSTON',
  type: 'VOR/DME',
  status: 'OPERATIONAL_IFR',
  lat: 42.3643,
  lon: -71.0052,
  country: 'US',
  frequencyMhz: 112.7,
};

const sampleFix: Fix = {
  identifier: 'MERIT',
  icaoRegionCode: 'K6',
  country: 'US',
  lat: 42.0,
  lon: -71.5,
  useCode: 'WP',
  pitch: false,
  catch: false,
  suaAtcaa: false,
  chartTypes: ['ENROUTE LOW'],
  navaidAssociations: [],
};

const sampleAirway: Airway = {
  designation: 'V16',
  type: 'VICTOR',
  region: 'US',
  waypoints: [
    { name: 'BOSTON', identifier: 'BOS', waypointType: 'NAVAID', lat: 42.36, lon: -71.0 },
  ],
};

const sampleAirspaceFeature: AirspaceFeature = {
  type: 'CLASS_B',
  name: 'JFK CLASS B',
  identifier: 'JFK',
  floor: { valueFt: 0, reference: 'SFC' },
  ceiling: { valueFt: 7000, reference: 'MSL' },
  boundary: { type: 'Polygon', coordinates: [] },
  state: 'NY',
  controllingFacility: 'N90',
  scheduleDescription: null,
  artccStratum: null,
};

describe('EntityInspector', () => {
  beforeEach(() => {
    useSearchMock.mockReset();
    useNavigateMock.mockReset();
    navigateMock.mockReset();
    useResolvedEntityMock.mockReset();
    useNavigateMock.mockReturnValue(navigateMock);
  });

  it('renders nothing when the resolution state is idle', () => {
    useSearchMock.mockReturnValue({ selected: undefined });
    useResolvedEntityMock.mockReturnValue({ status: 'idle' });
    const { container } = render(<EntityInspector />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a loading header when the relevant dataset is still streaming', () => {
    useSearchMock.mockReturnValue({ selected: 'airport:BOS' });
    useResolvedEntityMock.mockReturnValue({
      status: 'loading',
      ref: { type: 'airport', id: 'BOS' },
    });
    render(<EntityInspector />);
    expect(screen.getByRole('complementary', { name: /entity inspector/i })).toBeInTheDocument();
    expect(screen.getByText(/loading dataset/i)).toBeInTheDocument();
  });

  it('renders a not-found header for stale URL ids', () => {
    useSearchMock.mockReturnValue({ selected: 'airport:UNKNOWN' });
    useResolvedEntityMock.mockReturnValue({
      status: 'not-found',
      ref: { type: 'airport', id: 'UNKNOWN' },
    });
    render(<EntityInspector />);
    expect(screen.getByText(/no matching record/i)).toBeInTheDocument();
  });

  it('renders the airport panel when an airport resolves', () => {
    useSearchMock.mockReturnValue({ selected: 'airport:BOS' });
    useResolvedEntityMock.mockReturnValue({
      status: 'resolved',
      entity: { kind: 'airport', record: sampleAirport },
    });
    render(<EntityInspector />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/BOS/);
    expect(screen.getByText(sampleAirport.name)).toBeInTheDocument();
    expect(screen.getByText('Boston'.toUpperCase())).toBeInTheDocument();
    expect(screen.getByText(/119\.10 MHz/)).toBeInTheDocument();
  });

  it('renders the navaid panel with the correct frequency', () => {
    useSearchMock.mockReturnValue({ selected: 'navaid:BOS' });
    useResolvedEntityMock.mockReturnValue({
      status: 'resolved',
      entity: { kind: 'navaid', record: sampleNavaid },
    });
    render(<EntityInspector />);
    expect(screen.getByText(/112\.70 MHz/)).toBeInTheDocument();
  });

  it('renders the fix panel', () => {
    useSearchMock.mockReturnValue({ selected: 'fix:MERIT' });
    useResolvedEntityMock.mockReturnValue({
      status: 'resolved',
      entity: { kind: 'fix', record: sampleFix },
    });
    render(<EntityInspector />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('MERIT');
    expect(screen.getByText(/Waypoint/)).toBeInTheDocument();
  });

  it('renders the airway panel with the waypoint list', () => {
    useSearchMock.mockReturnValue({ selected: 'airway:V16' });
    useResolvedEntityMock.mockReturnValue({
      status: 'resolved',
      entity: { kind: 'airway', record: sampleAirway },
    });
    render(<EntityInspector />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('V16');
    expect(screen.getByText('BOS')).toBeInTheDocument();
  });

  it('renders the airspace panel with one section per matching feature', () => {
    useSearchMock.mockReturnValue({ selected: 'airspace:CLASS_B/JFK' });
    useResolvedEntityMock.mockReturnValue({
      status: 'resolved',
      entity: {
        kind: 'airspace',
        airspaceType: 'CLASS_B',
        identifier: 'JFK',
        features: [
          sampleAirspaceFeature,
          { ...sampleAirspaceFeature, ceiling: { valueFt: 10000, reference: 'MSL' } },
        ],
      },
    });
    render(<EntityInspector />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('JFK');
    expect(screen.getByText(/2 features/)).toBeInTheDocument();
    expect(screen.getByText(/7000 ft MSL/)).toBeInTheDocument();
    expect(screen.getByText(/10000 ft MSL/)).toBeInTheDocument();
  });

  it('clears selected from the URL when the close button is clicked', () => {
    useSearchMock.mockReturnValue({ selected: 'airport:BOS' });
    useResolvedEntityMock.mockReturnValue({
      status: 'resolved',
      entity: { kind: 'airport', record: sampleAirport },
    });
    render(<EntityInspector />);
    fireEvent.click(screen.getByRole('button', { name: /close inspector/i }));
    expect(navigateMock).toHaveBeenCalledTimes(1);
    const call = navigateMock.mock.calls[0]?.[0];
    expect(call?.replace).toBe(true);
    const searchUpdate = call?.search;
    expect(typeof searchUpdate).toBe('function');
    if (typeof searchUpdate === 'function') {
      const next = searchUpdate({ selected: 'airport:BOS', other: 'untouched' });
      expect(next).toEqual({ selected: undefined, other: 'untouched' });
    }
  });
});
