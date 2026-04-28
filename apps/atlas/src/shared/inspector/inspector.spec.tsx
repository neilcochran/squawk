import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Airport, Airway, AirspaceFeature, Fix, Navaid } from '@squawk/types';
import { AIRPORTS_LAYER_ID } from '../../modes/chart/layers/airports-layer.tsx';
import { AIRSPACE_FILL_LAYER_ID } from '../../modes/chart/layers/airspace-layer.tsx';
import type { InspectableFeature } from '../../modes/chart/click-to-select.ts';
import type { ResolvedEntityState } from './entity-resolver.ts';
import { EntityInspector } from './inspector.tsx';

function buildSiblingFeature(
  layerId: string,
  properties: Record<string, unknown>,
): InspectableFeature {
  return { layer: { id: layerId }, properties };
}

/**
 * Clicks the sibling-chip disclosure header to expand the chip groups,
 * which are collapsed by default. Tests that assert on chip buttons
 * call this first; the function throws if the disclosure isn't
 * rendered (e.g. no chips), which is the desired failure mode.
 */
function expandSiblingChips(): void {
  fireEvent.click(screen.getByRole('button', { name: /other feature/i }));
}

const {
  useSearchMock,
  useNavigateMock,
  navigateMock,
  useDatasetStatesMock,
  resolveMock,
  setHoveredChipSelectionMock,
  useMapMock,
} = vi.hoisted(() => ({
  useSearchMock: vi.fn(),
  useNavigateMock: vi.fn(),
  navigateMock: vi.fn(),
  useDatasetStatesMock: vi.fn(),
  resolveMock: vi.fn(),
  setHoveredChipSelectionMock: vi.fn(),
  useMapMock: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: useSearchMock }),
  useNavigate: useNavigateMock,
}));

vi.mock('./entity-resolver.ts', () => ({
  useDatasetStates: useDatasetStatesMock,
  resolveSelectionFromState: resolveMock,
}));

vi.mock('../../modes/chart/highlight-context.ts', () => ({
  useSetHoveredChipSelection: () => setHoveredChipSelectionMock,
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  useMap: useMapMock,
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

/**
 * Wires `resolveMock` to dispatch on the `selected` string. Selections in
 * the map return their listed state; everything else returns `idle`. The
 * inspector calls the resolver once for the main selection and once per
 * sibling chip, so the tests need a per-selection lookup rather than a
 * single fixed return value.
 */
function setupResolutions(map: Record<string, ResolvedEntityState>): void {
  resolveMock.mockImplementation((selected: string | undefined): ResolvedEntityState => {
    if (selected === undefined) {
      return { status: 'idle' };
    }
    const resolution = map[selected];
    return resolution ?? { status: 'idle' };
  });
}

/**
 * Default search-state shape so `useSearch()` returns every field the
 * inspector reads (selected, view-state, layer toggles). Per-test
 * overrides are merged in via {@link search}.
 */
const DEFAULT_SEARCH = {
  lat: 39.5,
  lon: -98.5,
  zoom: 4,
  pitch: 0,
  layers: ['airports', 'navaids', 'fixes', 'airways', 'airspace'],
  airspaceClasses: [
    'CLASS_B',
    'CLASS_C',
    'CLASS_D',
    'CLASS_E',
    'MOA',
    'RESTRICTED',
    'PROHIBITED',
    'WARNING',
    'ALERT',
    'NSA',
    'ARTCC',
  ],
  airwayCategories: ['LOW', 'HIGH', 'OCEANIC'],
  selected: undefined as string | undefined,
};

/** Builds a search-state object with the defaults plus per-test overrides. */
function search(overrides: Partial<typeof DEFAULT_SEARCH>): typeof DEFAULT_SEARCH {
  return { ...DEFAULT_SEARCH, ...overrides };
}

describe('EntityInspector', () => {
  beforeEach(() => {
    useSearchMock.mockReset();
    useNavigateMock.mockReset();
    navigateMock.mockReset();
    useDatasetStatesMock.mockReset();
    resolveMock.mockReset();
    setHoveredChipSelectionMock.mockReset();
    useMapMock.mockReset();
    useNavigateMock.mockReturnValue(navigateMock);
    // The bbox-overlap chip walk reads `datasets.airspace.status`, so the
    // mock must return a fully-shaped `ChartDatasetStates`. Loading state
    // is the most permissive default - none of the tests exercise the
    // bbox path, so a loading dataset short-circuits without coupling
    // tests to specific airspace records.
    useDatasetStatesMock.mockReturnValue({
      airport: { status: 'loading' },
      navaid: { status: 'loading' },
      fix: { status: 'loading' },
      airway: { status: 'loading' },
      airspace: { status: 'loading' },
    });
    // The inspector reads viewport bounds via `useMap()`; default to no
    // map so the bounds memo returns undefined and the bbox walk skips
    // the viewport filter. Tests that exercise the bbox path can override
    // this per-test if needed.
    useMapMock.mockReturnValue({});
  });

  const airportResolution: ResolvedEntityState = {
    status: 'resolved',
    entity: { kind: 'airport', record: sampleAirport },
  };
  const navaidResolution: ResolvedEntityState = {
    status: 'resolved',
    entity: { kind: 'navaid', record: sampleNavaid },
  };
  const fixResolution: ResolvedEntityState = {
    status: 'resolved',
    entity: { kind: 'fix', record: sampleFix },
  };
  const airwayResolution: ResolvedEntityState = {
    status: 'resolved',
    entity: { kind: 'airway', record: sampleAirway },
  };
  const airspaceResolution: ResolvedEntityState = {
    status: 'resolved',
    entity: {
      kind: 'airspace',
      airspaceType: 'CLASS_B',
      identifier: 'BOS',
      features: [{ ...sampleAirspaceFeature, identifier: 'BOS' }],
    },
  };

  it('renders nothing when the resolution state is idle', () => {
    useSearchMock.mockReturnValue(search({ selected: undefined }));
    setupResolutions({});
    const { container } = render(<EntityInspector />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a loading header when the relevant dataset is still streaming', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': { status: 'loading', ref: { type: 'airport', id: 'BOS' } },
    });
    render(<EntityInspector />);
    expect(screen.getByRole('complementary', { name: /entity inspector/i })).toBeInTheDocument();
    expect(screen.getByText(/loading dataset/i)).toBeInTheDocument();
  });

  it('renders a not-found header for stale URL ids', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:UNKNOWN' }));
    setupResolutions({
      'airport:UNKNOWN': { status: 'not-found', ref: { type: 'airport', id: 'UNKNOWN' } },
    });
    render(<EntityInspector />);
    expect(screen.getByText(/no matching record/i)).toBeInTheDocument();
  });

  it('renders the airport panel when an airport resolves', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({ 'airport:BOS': airportResolution });
    render(<EntityInspector />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/BOS/);
    expect(screen.getByText(sampleAirport.name)).toBeInTheDocument();
    expect(screen.getByText('Boston'.toUpperCase())).toBeInTheDocument();
    expect(screen.getByText(/119\.10 MHz/)).toBeInTheDocument();
  });

  it('renders the navaid panel with the correct frequency', () => {
    useSearchMock.mockReturnValue(search({ selected: 'navaid:BOS' }));
    setupResolutions({ 'navaid:BOS': navaidResolution });
    render(<EntityInspector />);
    expect(screen.getByText(/112\.70 MHz/)).toBeInTheDocument();
  });

  it('renders the fix panel', () => {
    useSearchMock.mockReturnValue(search({ selected: 'fix:MERIT' }));
    setupResolutions({ 'fix:MERIT': fixResolution });
    render(<EntityInspector />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('MERIT');
    expect(screen.getByText(/Waypoint/)).toBeInTheDocument();
  });

  it('renders the airway panel with the waypoint list', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airway:V16' }));
    setupResolutions({ 'airway:V16': airwayResolution });
    render(<EntityInspector />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('V16');
    expect(screen.getByText('BOS')).toBeInTheDocument();
  });

  it('renders the airspace panel with one section per matching feature', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airspace:CLASS_B/JFK' }));
    setupResolutions({
      'airspace:CLASS_B/JFK': {
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
      },
    });
    render(<EntityInspector />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('JFK');
    expect(screen.getByText(/2 features/)).toBeInTheDocument();
    expect(screen.getByText(/7000 ft MSL/)).toBeInTheDocument();
    expect(screen.getByText(/10000 ft MSL/)).toBeInTheDocument();
  });

  it('clears selected from the URL when the close button is clicked', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({ 'airport:BOS': airportResolution });
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

  it('does not render the sibling chip disclosure when no siblings are passed', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({ 'airport:BOS': airportResolution });
    render(<EntityInspector />);
    expect(screen.queryByRole('button', { name: /other feature/i })).not.toBeInTheDocument();
  });

  it('renders the disclosure collapsed by default with a chip count in the header', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'airspace:CLASS_B/BOS': airspaceResolution,
      'airspace:ARTCC/ZBW': {
        status: 'resolved',
        entity: {
          kind: 'airspace',
          airspaceType: 'ARTCC',
          identifier: 'ZBW',
          features: [{ ...sampleAirspaceFeature, type: 'ARTCC', identifier: 'ZBW' }],
        },
      },
    });
    render(
      <EntityInspector
        siblings={[
          buildSiblingFeature(AIRPORTS_LAYER_ID, { faaId: 'BOS' }),
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'BOS' }),
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'ARTCC', identifier: 'ZBW' }),
        ]}
      />,
    );
    // Two siblings end up as chips (the airport is the current selection).
    const header = screen.getByRole('button', { name: /2 other features here/i });
    expect(header).toHaveAttribute('aria-expanded', 'false');
    // Chips should not be rendered while collapsed.
    expect(screen.queryByRole('button', { name: 'CLASS B BOS' })).not.toBeInTheDocument();
  });

  it('renders a chip for each sibling that resolves and is not the current selection', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'airspace:CLASS_B/BOS': airspaceResolution,
      'airspace:ARTCC/ZBW': {
        status: 'resolved',
        entity: {
          kind: 'airspace',
          airspaceType: 'ARTCC',
          identifier: 'ZBW',
          features: [{ ...sampleAirspaceFeature, type: 'ARTCC', identifier: 'ZBW' }],
        },
      },
    });
    render(
      <EntityInspector
        siblings={[
          buildSiblingFeature(AIRPORTS_LAYER_ID, { faaId: 'BOS' }),
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'BOS' }),
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'ARTCC', identifier: 'ZBW' }),
        ]}
      />,
    );
    expandSiblingChips();
    expect(screen.getByRole('button', { name: 'CLASS B BOS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ARTCC ZBW' })).toBeInTheDocument();
    // The currently-selected airport is excluded from the strip.
    expect(screen.queryByRole('button', { name: 'BOS' })).not.toBeInTheDocument();
  });

  it('groups expanded chips by feature type with a header per non-empty group', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'airspace:CLASS_B/BOS': airspaceResolution,
      'airspace:ARTCC/ZBW': {
        status: 'resolved',
        entity: {
          kind: 'airspace',
          airspaceType: 'ARTCC',
          identifier: 'ZBW',
          features: [{ ...sampleAirspaceFeature, type: 'ARTCC', identifier: 'ZBW' }],
        },
      },
    });
    render(
      <EntityInspector
        siblings={[
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'BOS' }),
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'ARTCC', identifier: 'ZBW' }),
        ]}
      />,
    );
    expandSiblingChips();
    // Only the airspace group has chips, so only its header should render.
    expect(screen.getByText(/^airspace$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^airports$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^navaids$/i)).not.toBeInTheDocument();
  });

  it('deduplicates chips by encoded selection so two rings collapse to one', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'airspace:CLASS_B/BOS': airspaceResolution,
    });
    render(
      <EntityInspector
        siblings={[
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'BOS' }),
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'BOS' }),
        ]}
      />,
    );
    expandSiblingChips();
    expect(screen.getAllByRole('button', { name: 'CLASS B BOS' })).toHaveLength(1);
  });

  it('drops chips whose selection would resolve to not-found', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    // The Class B chip resolves cleanly; the ARTCC chip would be a stale
    // not-found and must be filtered out before render so the user does
    // not get a confusing empty panel on click.
    setupResolutions({
      'airport:BOS': airportResolution,
      'airspace:CLASS_B/BOS': airspaceResolution,
      'airspace:ARTCC/ZBW': {
        status: 'not-found',
        ref: { type: 'airspace', id: 'ARTCC/ZBW' },
      },
    });
    render(
      <EntityInspector
        siblings={[
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'BOS' }),
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'ARTCC', identifier: 'ZBW' }),
        ]}
      />,
    );
    expandSiblingChips();
    expect(screen.getByRole('button', { name: 'CLASS B BOS' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ARTCC ZBW' })).not.toBeInTheDocument();
  });

  it('writes the chip selection to the URL when a chip is clicked', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'airspace:CLASS_B/BOS': airspaceResolution,
    });
    render(
      <EntityInspector
        siblings={[
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'BOS' }),
        ]}
      />,
    );
    expandSiblingChips();
    fireEvent.click(screen.getByRole('button', { name: 'CLASS B BOS' }));
    expect(navigateMock).toHaveBeenCalledTimes(1);
    const call = navigateMock.mock.calls[0]?.[0];
    const searchUpdate = call?.search;
    if (typeof searchUpdate === 'function') {
      const next = searchUpdate({ selected: 'airport:BOS' });
      expect(next).toEqual({ selected: 'airspace:CLASS_B/BOS' });
    }
  });

  it('reports chip hover-enter and hover-leave so chart-mode can highlight', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'airspace:CLASS_B/BOS': airspaceResolution,
    });
    render(
      <EntityInspector
        siblings={[
          buildSiblingFeature(AIRSPACE_FILL_LAYER_ID, { type: 'CLASS_B', identifier: 'BOS' }),
        ]}
      />,
    );
    expandSiblingChips();
    const chip = screen.getByRole('button', { name: 'CLASS B BOS' });
    fireEvent.mouseEnter(chip);
    expect(setHoveredChipSelectionMock).toHaveBeenLastCalledWith('airspace:CLASS_B/BOS');
    fireEvent.mouseLeave(chip);
    expect(setHoveredChipSelectionMock).toHaveBeenLastCalledWith(undefined);
  });
});
