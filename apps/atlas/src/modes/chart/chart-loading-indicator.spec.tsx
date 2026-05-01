import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ChartLoadingIndicator } from './chart-loading-indicator.tsx';
import * as airportDataset from '../../shared/data/airport-dataset.ts';
import * as airspaceDataset from '../../shared/data/airspace-dataset.ts';
import * as airwayDataset from '../../shared/data/airway-dataset.ts';
import * as fixDataset from '../../shared/data/fix-dataset.ts';
import * as navaidDataset from '../../shared/data/navaid-dataset.ts';

interface FakeMap {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  triggerRepaint: ReturnType<typeof vi.fn>;
  fireIdle: () => void;
}

const { mapMock } = vi.hoisted(() => ({
  mapMock: { current: undefined } as { current: FakeMap | undefined },
}));

function buildFakeMap(): FakeMap {
  const handlers = new Set<() => void>();
  const fake: FakeMap = {
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'idle') {
        handlers.add(handler);
      }
    }) as never,
    off: vi.fn((event: string, handler: () => void) => {
      if (event === 'idle') {
        handlers.delete(handler);
      }
    }) as never,
    triggerRepaint: vi.fn(),
    fireIdle: () => {
      for (const h of handlers) {
        h();
      }
    },
  };
  return fake;
}

// `@vis.gl/react-maplibre` pulls in MapLibre, which relies on
// browser-only WebGL/canvas APIs that jsdom does not provide. The
// indicator reads `useMap().current?.getMap()`; we expose a controllable
// fake map so tests can fire the `idle` event directly.
vi.mock('@vis.gl/react-maplibre', () => ({
  useMap: () => ({
    current: mapMock.current === undefined ? undefined : { getMap: () => mapMock.current },
  }),
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

function loaded(): { status: 'loaded'; dataset: never } {
  return { status: 'loaded', dataset: {} as never };
}

describe('ChartLoadingIndicator', () => {
  beforeEach(() => {
    // Default: every dataset is still loading. Individual tests can
    // override one or more slots to exercise different branches.
    vi.mocked(airportDataset.useAirportDataset).mockReturnValue({ status: 'loading' });
    vi.mocked(airspaceDataset.useAirspaceDataset).mockReturnValue({ status: 'loading' });
    vi.mocked(airwayDataset.useAirwayDataset).mockReturnValue({ status: 'loading' });
    vi.mocked(fixDataset.useFixDataset).mockReturnValue({ status: 'loading' });
    vi.mocked(navaidDataset.useNavaidDataset).mockReturnValue({ status: 'loading' });
    mapMock.current = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('shows the rendering message once every dataset has loaded but the map is not yet idle', () => {
    vi.mocked(airportDataset.useAirportDataset).mockReturnValue(loaded());
    vi.mocked(airspaceDataset.useAirspaceDataset).mockReturnValue(loaded());
    vi.mocked(airwayDataset.useAirwayDataset).mockReturnValue(loaded());
    vi.mocked(fixDataset.useFixDataset).mockReturnValue(loaded());
    vi.mocked(navaidDataset.useNavaidDataset).mockReturnValue(loaded());
    render(<ChartLoadingIndicator />);
    expect(screen.getByText('Rendering map...')).toBeInTheDocument();
  });

  it('subscribes to the map idle event, dismisses, and unmounts the indicator', () => {
    vi.useFakeTimers();
    const fake = buildFakeMap();
    mapMock.current = fake;
    vi.mocked(airportDataset.useAirportDataset).mockReturnValue(loaded());
    vi.mocked(airspaceDataset.useAirspaceDataset).mockReturnValue(loaded());
    vi.mocked(airwayDataset.useAirwayDataset).mockReturnValue(loaded());
    vi.mocked(fixDataset.useFixDataset).mockReturnValue(loaded());
    vi.mocked(navaidDataset.useNavaidDataset).mockReturnValue(loaded());
    render(<ChartLoadingIndicator />);
    expect(fake.on).toHaveBeenCalledWith('idle', expect.any(Function));
    expect(fake.triggerRepaint).toHaveBeenCalled();
    act(() => {
      fake.fireIdle();
    });
    expect(screen.getByText('Loading complete')).toBeInTheDocument();
    // Hold timer (400ms) -> dismissing -> fade timer (300ms) -> dismissed.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('falls back to the render-fallback timer when idle never fires', () => {
    vi.useFakeTimers();
    const fake = buildFakeMap();
    mapMock.current = fake;
    vi.mocked(airportDataset.useAirportDataset).mockReturnValue(loaded());
    vi.mocked(airspaceDataset.useAirspaceDataset).mockReturnValue(loaded());
    vi.mocked(airwayDataset.useAirwayDataset).mockReturnValue(loaded());
    vi.mocked(fixDataset.useFixDataset).mockReturnValue(loaded());
    vi.mocked(navaidDataset.useNavaidDataset).mockReturnValue(loaded());
    render(<ChartLoadingIndicator />);
    expect(screen.getByText('Rendering map...')).toBeInTheDocument();
    // 5000ms fallback elapses without idle ever firing -> complete.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Loading complete')).toBeInTheDocument();
  });

  it('the Reload button is wired to window.location.reload', () => {
    vi.mocked(navaidDataset.useNavaidDataset).mockReturnValue({
      status: 'error',
      error: new Error('boom'),
    });
    // jsdom's window.location.reload is non-configurable, so spying on
    // it directly errors. Replace it via a property descriptor instead.
    const original = window.location;
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...original, reload: reloadSpy },
    });
    try {
      render(<ChartLoadingIndicator />);
      fireEvent.click(screen.getByRole('button', { name: /reload/i }));
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });
});
