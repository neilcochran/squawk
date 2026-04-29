import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Airport, Airway, AirspaceFeature, Fix, Navaid } from '@squawk/types';
import { AIRPORTS_LAYER_ID } from '../../modes/chart/layers/airports-layer.tsx';
import { AIRSPACE_FILL_LAYER_ID } from '../../modes/chart/layers/airspace-layer.tsx';
import { NAVAIDS_LAYER_ID } from '../../modes/chart/layers/navaids-layer.tsx';
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
  setHoveredFeatureIndexMock,
  useMapMock,
} = vi.hoisted(() => ({
  useSearchMock: vi.fn(),
  useNavigateMock: vi.fn(),
  navigateMock: vi.fn(),
  useDatasetStatesMock: vi.fn(),
  resolveMock: vi.fn(),
  setHoveredChipSelectionMock: vi.fn(),
  setHoveredFeatureIndexMock: vi.fn(),
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
  useSetHoveredFeatureIndex: () => setHoveredFeatureIndexMock,
  // Hooks the airway-panel + row-hover-pan use; tests do not exercise
  // the airway-row hover code paths directly, so the value is
  // undefined and the setter is a stable no-op stub.
  useHoveredAirwayWaypointIndex: () => undefined,
  useSetHoveredAirwayWaypointIndex: () => () => {},
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
    setHoveredFeatureIndexMock.mockReset();
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

  it('reports the hovered feature index on per-section pointer enter / leave', () => {
    // Hovering an airspace section in the inspector should report its
    // index up through the highlight context so the airspace layer's
    // feature-focus filter can brighten just that polygon. Two features
    // here so the panel has two distinct sections.
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

    // Section headings are rendered as small-caps "Feature 1" and
    // "Feature 2"; their parent section element is the pointer target.
    const section1 = screen.getByText('Feature 1').closest('section');
    const section2 = screen.getByText('Feature 2').closest('section');
    if (section1 === null || section2 === null) {
      throw new Error('expected both feature sections to be in the document');
    }

    fireEvent.pointerEnter(section1);
    expect(setHoveredFeatureIndexMock).toHaveBeenLastCalledWith(0);
    fireEvent.pointerLeave(section1);
    expect(setHoveredFeatureIndexMock).toHaveBeenLastCalledWith(undefined);

    fireEvent.pointerEnter(section2);
    expect(setHoveredFeatureIndexMock).toHaveBeenLastCalledWith(1);
    fireEvent.pointerLeave(section2);
    expect(setHoveredFeatureIndexMock).toHaveBeenLastCalledWith(undefined);
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

  it('exposes a recenter button in the header for resolved entities', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({ 'airport:BOS': airportResolution });
    render(<EntityInspector />);
    expect(screen.getByRole('button', { name: /recenter on this feature/i })).toBeInTheDocument();
  });

  it('hides the recenter button while the relevant dataset is still loading', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': { status: 'loading', ref: { type: 'airport', id: 'BOS' } },
    });
    render(<EntityInspector />);
    expect(
      screen.queryByRole('button', { name: /recenter on this feature/i }),
    ).not.toBeInTheDocument();
  });

  it('hides the recenter button when the URL points at a stale id (not-found)', () => {
    useSearchMock.mockReturnValue(search({ selected: 'airport:NOPE' }));
    setupResolutions({
      'airport:NOPE': { status: 'not-found', ref: { type: 'airport', id: 'NOPE' } },
    });
    render(<EntityInspector />);
    expect(
      screen.queryByRole('button', { name: /recenter on this feature/i }),
    ).not.toBeInTheDocument();
  });

  it('eases the camera with an inspector-width offset when the recenter button is clicked', () => {
    const easeToMock = vi.fn();
    useMapMock.mockReturnValue({
      default: {
        getMap: () => ({
          easeTo: easeToMock,
          project: vi.fn().mockReturnValue({ x: 0, y: 0 }),
          getCanvas: vi.fn().mockReturnValue({ clientWidth: 1280, clientHeight: 800 }),
          getCenter: vi.fn().mockReturnValue({ lng: -71, lat: 42 }),
          getBounds: vi.fn().mockReturnValue({
            getWest: () => -180,
            getEast: () => 180,
            getSouth: () => -90,
            getNorth: () => 90,
          }),
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
    });
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({ 'airport:BOS': airportResolution });
    render(<EntityInspector />);

    fireEvent.click(screen.getByRole('button', { name: /recenter on this feature/i }));
    expect(easeToMock).toHaveBeenCalledTimes(1);
    const arg = easeToMock.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      center: [sampleAirport.lon, sampleAirport.lat],
      offset: [-180, 0],
    });
  });

  it('pans on chip hover-enter and restores on hover-leave when the chip target is occluded by the inspector', () => {
    const easeToMock = vi.fn();
    // project() returns x=1100 against canvas width 1280, so the
    // chip's centroid falls inside the right 360px panel overlay
    // and the pan kicks in.
    useMapMock.mockReturnValue({
      default: {
        getMap: () => ({
          easeTo: easeToMock,
          project: vi.fn().mockReturnValue({ x: 1100, y: 400 }),
          getCanvas: vi.fn().mockReturnValue({ clientWidth: 1280, clientHeight: 800 }),
          getCenter: vi.fn().mockReturnValue({ lng: -71, lat: 42 }),
          getBounds: vi.fn().mockReturnValue({
            getWest: () => -180,
            getEast: () => 180,
            getSouth: () => -90,
            getNorth: () => 90,
          }),
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
    });
    // Selection is the airport; the chip is a nearby navaid that has
    // a usable centroid (sampleNavaid carries lat/lon, unlike the
    // empty-polygon airspace fixture).
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'navaid:BOS': navaidResolution,
    });
    render(
      <EntityInspector siblings={[buildSiblingFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' })]} />,
    );
    expandSiblingChips();
    const chip = screen.getByRole('button', { name: 'BOS' });

    fireEvent.mouseEnter(chip);
    expect(easeToMock).toHaveBeenCalledTimes(1);
    expect(easeToMock.mock.calls[0]?.[0]).toMatchObject({
      center: [sampleNavaid.lon, sampleNavaid.lat],
      offset: [-180, 0],
    });

    fireEvent.mouseLeave(chip);
    expect(easeToMock).toHaveBeenCalledTimes(2);
    // Restore call eases back to the captured pre-pan center, with no
    // inspector offset (the user established that view themselves).
    const restoreArg = easeToMock.mock.calls[1]?.[0];
    expect(restoreArg).toMatchObject({ center: [-71, 42] });
    expect(restoreArg.offset).toBeUndefined();
  });

  it('preserves the captured pre-pan center across a sequence of chip hovers within the same session', () => {
    // Regression for the chip-reorder bounce: when the camera pans
    // toward an occluded chip, the moveend updates URL view-state,
    // recomputes `viewportBounds`, and reshuffles bbox-overlap chips.
    // In a real browser the cursor lands on a different chip, firing
    // mouseleave on the original and mouseenter on the new chip, which
    // triggers another pan, etc. Jsdom can't simulate the chip
    // reorder, but we can at least assert the state machine itself
    // doesn't recapture the pre-pan center on a follow-up hover -
    // recapturing would mean the eventual restore eases back to a
    // mid-pan position instead of the user's true starting view.
    const easeToMock = vi.fn();
    const getCenterMock = vi
      .fn()
      .mockReturnValueOnce({ lng: -71, lat: 42 }) // first hover sees the original center
      .mockReturnValue({ lng: -90, lat: 38 }); // any subsequent calls see the post-pan center
    useMapMock.mockReturnValue({
      default: {
        getMap: () => ({
          easeTo: easeToMock,
          project: vi.fn().mockReturnValue({ x: 1100, y: 400 }),
          getCanvas: vi.fn().mockReturnValue({ clientWidth: 1280, clientHeight: 800 }),
          getCenter: getCenterMock,
          getBounds: vi.fn().mockReturnValue({
            getWest: () => -180,
            getEast: () => 180,
            getSouth: () => -90,
            getNorth: () => 90,
          }),
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
    });
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'navaid:BOS': navaidResolution,
      'fix:MERIT': fixResolution,
    });
    render(
      <EntityInspector
        siblings={[
          buildSiblingFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' }),
          buildSiblingFeature('atlas-fixes-circle', { identifier: 'MERIT' }),
        ]}
      />,
    );
    expandSiblingChips();
    const navChip = screen.getByRole('button', { name: 'BOS' });
    const fixChip = screen.getByRole('button', { name: 'MERIT' });

    // Hover navaid chip first - captures pre-pan center { lng: -71, lat: 42 }.
    fireEvent.mouseEnter(navChip);
    fireEvent.mouseLeave(navChip);
    // Mouse jumps directly to the fix chip without ever leaving the
    // inspector (mimics a chip-strip reorder under a stationary cursor).
    fireEvent.mouseEnter(fixChip);
    fireEvent.mouseLeave(fixChip);

    // Four easeTo calls total: pan to nav, restore to original, pan to
    // fix, restore to original. Both restores must use the FIRST
    // captured center, not a stale post-pan one.
    expect(easeToMock).toHaveBeenCalledTimes(4);
    const firstRestore = easeToMock.mock.calls[1]?.[0];
    const secondRestore = easeToMock.mock.calls[3]?.[0];
    expect(firstRestore).toMatchObject({ center: [-71, 42] });
    expect(secondRestore).toMatchObject({ center: [-71, 42] });
  });

  it('does not recompute the chip list when the viewport changes during a hover session', () => {
    // Regression for the chip-reorder bounce: while a hover-pan is in
    // flight, the moveend that follows updates the URL view-state and
    // therefore `viewportBounds`. Without `hoverViewportFreeze` holding
    // the chip-composition viewport stable, the `chips` useMemo would
    // re-run against the new viewport, the strip would reorder under
    // the cursor, mouseleave/mouseenter would fire on different chips,
    // and the camera would chase a new target - the bounce. This test
    // does not mock physical chip layout (jsdom can't), but it pins
    // the underlying invariant: the chip-resolution useMemo must NOT
    // re-evaluate when only `viewportBounds` changes mid-session.
    const easeToMock = vi.fn();
    useMapMock.mockReturnValue({
      default: {
        getMap: () => ({
          easeTo: easeToMock,
          project: vi.fn().mockReturnValue({ x: 1100, y: 400 }),
          getCanvas: vi.fn().mockReturnValue({ clientWidth: 1280, clientHeight: 800 }),
          getCenter: vi.fn().mockReturnValue({ lng: -71, lat: 42 }),
          getBounds: vi.fn().mockReturnValue({
            getWest: () => -180,
            getEast: () => 180,
            getSouth: () => -90,
            getNorth: () => 90,
          }),
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
    });
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'navaid:BOS': navaidResolution,
    });
    const sibling = [buildSiblingFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' })];
    const { rerender } = render(<EntityInspector siblings={sibling} />);

    expandSiblingChips();
    const chip = screen.getByRole('button', { name: 'BOS' });

    // Hover starts the pan and snaps the viewport freeze.
    fireEvent.mouseEnter(chip);
    fireEvent.mouseLeave(chip);

    // Baseline: how many times has the resolver been called for the
    // chip's selection so far? Subsequent renders without a cache miss
    // should not increment this.
    const baselineNavaidCalls = resolveMock.mock.calls.filter(
      (call) => call[0] === 'navaid:BOS',
    ).length;

    // Simulate the URL view-state changing after the pan animation ends
    // (chart-mode would call navigate with new lat/lon/zoom on moveend).
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS', lat: 30, lon: -90, zoom: 8 }));
    rerender(<EntityInspector siblings={sibling} />);

    // With the freeze working, `chipViewportBounds` stays equal to the
    // snapshot taken on hover and the chips useMemo cache-hits. Without
    // the freeze (the original regression) the memo would recompute
    // and call the resolver again for the chip's selection.
    const postRerenderNavaidCalls = resolveMock.mock.calls.filter(
      (call) => call[0] === 'navaid:BOS',
    ).length;
    expect(postRerenderNavaidCalls).toBe(baselineNavaidCalls);
  });

  it('skips the chip-hover pan when the chip target is already in the un-occluded portion of the map', () => {
    const easeToMock = vi.fn();
    // project() returns x=200 against canvas width 1280: the chip's
    // centroid is far from the inspector edge (right 360px starts at
    // x=920), so no pan should fire.
    useMapMock.mockReturnValue({
      default: {
        getMap: () => ({
          easeTo: easeToMock,
          project: vi.fn().mockReturnValue({ x: 200, y: 400 }),
          getCanvas: vi.fn().mockReturnValue({ clientWidth: 1280, clientHeight: 800 }),
          getCenter: vi.fn().mockReturnValue({ lng: -71, lat: 42 }),
          getBounds: vi.fn().mockReturnValue({
            getWest: () => -180,
            getEast: () => 180,
            getSouth: () => -90,
            getNorth: () => 90,
          }),
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
    });
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'navaid:BOS': navaidResolution,
    });
    render(
      <EntityInspector siblings={[buildSiblingFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' })]} />,
    );
    expandSiblingChips();
    const chip = screen.getByRole('button', { name: 'BOS' });

    fireEvent.mouseEnter(chip);
    fireEvent.mouseLeave(chip);
    expect(easeToMock).not.toHaveBeenCalled();
  });

  it('pans to the chip target on commit click and calls navigate with the new selection', () => {
    const easeToMock = vi.fn();
    // project returns a centered point so isPointOutsideComfortableArea
    // is false during hover - this isolates the pan-on-commit test from
    // any preview-pan behavior. Even with the chip target onscreen,
    // commit should pan because committing is a deliberate selection,
    // not a preview hover.
    useMapMock.mockReturnValue({
      default: {
        getMap: () => ({
          easeTo: easeToMock,
          project: vi.fn().mockReturnValue({ x: 400, y: 400 }),
          getCanvas: vi.fn().mockReturnValue({ clientWidth: 1280, clientHeight: 800 }),
          getCenter: vi.fn().mockReturnValue({ lng: -71, lat: 42 }),
          getBounds: vi.fn().mockReturnValue({
            getWest: () => -180,
            getEast: () => 180,
            getSouth: () => -90,
            getNorth: () => 90,
          }),
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
    });
    useSearchMock.mockReturnValue(search({ selected: 'airport:BOS' }));
    setupResolutions({
      'airport:BOS': airportResolution,
      'navaid:BOS': navaidResolution,
    });
    render(
      <EntityInspector siblings={[buildSiblingFeature(NAVAIDS_LAYER_ID, { identifier: 'BOS' })]} />,
    );
    expandSiblingChips();
    const chip = screen.getByRole('button', { name: 'BOS' });

    fireEvent.click(chip);

    // Pan-on-commit should fire with the navaid's centroid and the
    // standard inspector-aware offset.
    expect(easeToMock).toHaveBeenCalledTimes(1);
    expect(easeToMock.mock.calls[0]?.[0]).toMatchObject({
      center: [sampleNavaid.lon, sampleNavaid.lat],
      offset: [-180, 0],
    });
    // And the URL navigation should still fire.
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock.mock.calls[0]?.[0]).toMatchObject({
      search: expect.any(Function),
      replace: true,
    });
  });
});
