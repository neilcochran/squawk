import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartLoadingIndicator } from './chart-loading-indicator.tsx';
import * as airportDataset from '../../shared/data/airport-dataset.ts';
import * as airspaceDataset from '../../shared/data/airspace-dataset.ts';
import * as airwayDataset from '../../shared/data/airway-dataset.ts';
import * as fixDataset from '../../shared/data/fix-dataset.ts';
import * as navaidDataset from '../../shared/data/navaid-dataset.ts';

// `@vis.gl/react-maplibre` pulls in MapLibre, which relies on
// browser-only WebGL/canvas APIs that jsdom does not provide. The
// indicator only reads `useMap().current?.getMap()`, so an undefined
// `current` is enough - the idle-subscription effect bails out and the
// fallback timer takes over (we never advance it in these tests).
vi.mock('@vis.gl/react-maplibre', () => ({
  useMap: () => ({ current: undefined }),
}));

vi.mock('../../shared/data/airport-dataset.ts', () => ({
  useAirportDataset: vi.fn(),
}));
vi.mock('../../shared/data/airspace-dataset.ts', () => ({
  useAirspaceDataset: vi.fn(),
}));
vi.mock('../../shared/data/airway-dataset.ts', () => ({
  useAirwayDataset: vi.fn(),
}));
vi.mock('../../shared/data/fix-dataset.ts', () => ({
  useFixDataset: vi.fn(),
}));
vi.mock('../../shared/data/navaid-dataset.ts', () => ({
  useNavaidDataset: vi.fn(),
}));

describe('ChartLoadingIndicator', () => {
  beforeEach(() => {
    // Default: every dataset is still loading. Individual tests can
    // override one or more slots to exercise different branches.
    vi.mocked(airportDataset.useAirportDataset).mockReturnValue({ status: 'loading' });
    vi.mocked(airspaceDataset.useAirspaceDataset).mockReturnValue({ status: 'loading' });
    vi.mocked(airwayDataset.useAirwayDataset).mockReturnValue({ status: 'loading' });
    vi.mocked(fixDataset.useFixDataset).mockReturnValue({ status: 'loading' });
    vi.mocked(navaidDataset.useNavaidDataset).mockReturnValue({ status: 'loading' });
  });

  it('renders the first still-loading dataset message during load', () => {
    render(<ChartLoadingIndicator />);
    // Slots are ordered smallest-`.gz`-first; navaids is slot 0, so its
    // loading label is the message shown when every dataset is in
    // flight.
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Tuning navaids...')).toBeInTheDocument();
  });

  it('progresses to the next slot when an earlier dataset finishes', () => {
    vi.mocked(navaidDataset.useNavaidDataset).mockReturnValue({
      status: 'loaded',
      // Cast through unknown is intentional: the test only needs the
      // shape of the discriminated union, not a real dataset value, and
      // the union variant for `loaded` requires a `dataset` field. The
      // component never reads the dataset itself in the message branch
      // we are exercising here.
      dataset: {} as never,
    });
    render(<ChartLoadingIndicator />);
    // With navaids loaded, airways becomes the first still-loading slot.
    expect(screen.getByText('Plotting airways...')).toBeInTheDocument();
  });

  it('switches to the error card with a reload button when a dataset fails', () => {
    vi.mocked(navaidDataset.useNavaidDataset).mockReturnValue({
      status: 'error',
      error: new Error('test failure'),
    });
    render(<ChartLoadingIndicator />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/couldn't load navaids/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });
});
