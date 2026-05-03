import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MAP_MAX_PITCH } from './map-canvas.tsx';
import { ZoomControls } from './zoom-controls.tsx';

const {
  useMapMock,
  easeToMock,
  getZoomMock,
  getPitchMock,
  getMinZoomMock,
  getMaxZoomMock,
  onMock,
  offMock,
} = vi.hoisted(() => ({
  useMapMock: vi.fn(),
  easeToMock: vi.fn(),
  getZoomMock: vi.fn(),
  getPitchMock: vi.fn(),
  getMinZoomMock: vi.fn(),
  getMaxZoomMock: vi.fn(),
  onMock: vi.fn(),
  offMock: vi.fn(),
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  useMap: useMapMock,
}));

/**
 * Captures the most recent shared `onChange` callback registered with the
 * map's `zoomend`/`pitchend` events. ZoomControls subscribes once via
 * useSyncExternalStore for both events, so a single fire on either event
 * triggers a re-evaluation of the snapshot.
 */
function getViewChangeHandler(): (() => void) | undefined {
  const call = onMock.mock.calls.find((entry) => entry[0] === 'zoomend' || entry[0] === 'pitchend');
  return call?.[1];
}

describe('ZoomControls', () => {
  beforeEach(() => {
    easeToMock.mockClear();
    getZoomMock.mockClear();
    getPitchMock.mockClear();
    getMinZoomMock.mockClear();
    getMaxZoomMock.mockClear();
    onMock.mockClear();
    offMock.mockClear();
    getZoomMock.mockReturnValue(4);
    getPitchMock.mockReturnValue(0);
    getMinZoomMock.mockReturnValue(0);
    getMaxZoomMock.mockReturnValue(22);
    // Mirror @vis.gl/react-maplibre's MapCollection: the unnamed Map
    // registers itself under `default`, while `current` is only set when
    // the consumer is rendered inside the Map's context. ZoomControls
    // sits outside `<Map>`, so it must work off `default`.
    useMapMock.mockReturnValue({
      default: {
        getMap: () => ({
          easeTo: easeToMock,
          getZoom: getZoomMock,
          getPitch: getPitchMock,
          getMinZoom: getMinZoomMock,
          getMaxZoom: getMaxZoomMock,
          on: onMock,
          off: offMock,
        }),
      },
    });
  });

  it('renders the zoom and tilt buttons', () => {
    render(<ZoomControls />);
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tilt up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tilt down/i })).toBeInTheDocument();
  });

  it('renders the current zoom as a readout chip with an aria-label', () => {
    // The chip pairs with the layer-toggle dropdown's "Zoom N+" hint, so
    // it shares the same numeric language. Integer zooms drop the
    // decimal for a cleaner glyph.
    render(<ZoomControls />);
    const readout = screen.getByRole('status');
    expect(readout).toHaveTextContent('4');
    expect(readout).toHaveAttribute('aria-label', 'Current zoom: 4');
  });

  it('renders a magnifying glass icon next to the zoom number so the readout reads as a zoom level', () => {
    // The icon makes the meaning of "4" obvious - without it the
    // chip looks like a generic count. Stays decorative (aria-hidden)
    // because the readout's aria-label already conveys the meaning.
    render(<ZoomControls />);
    const readout = screen.getByRole('status');
    const icon = readout.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('formats fractional zooms to one decimal in the readout', () => {
    getZoomMock.mockReturnValue(4.5);
    render(<ZoomControls />);
    const readout = screen.getByRole('status');
    expect(readout).toHaveTextContent('4.5');
    expect(readout).toHaveAttribute('aria-label', 'Current zoom: 4.5');
  });

  it('rounds zooms before formatting so 4.04 reads as "4" and 4.95 reads as "5"', () => {
    // Without the round-then-format step a naive toFixed(1) on 4.04
    // would yield "4.0" (with a stray decimal) and 4.95 would render
    // "5.0" - both surprises. The formatter rounds first so the chip
    // stays compact and predictable.
    getZoomMock.mockReturnValue(4.04);
    const { unmount } = render(<ZoomControls />);
    expect(screen.getByRole('status')).toHaveTextContent('4');
    unmount();

    getZoomMock.mockReturnValue(4.95);
    render(<ZoomControls />);
    expect(screen.getByRole('status')).toHaveTextContent('5');
  });

  it('eases to current zoom + 1 when the zoom-in button is clicked', () => {
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(easeToMock).toHaveBeenCalledTimes(1);
    expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({ zoom: 5 }));
  });

  it('eases to current zoom - 1 when the zoom-out button is clicked', () => {
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(easeToMock).toHaveBeenCalledTimes(1);
    expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({ zoom: 3 }));
  });

  it('prefers map.current when rendered inside a Map context', () => {
    const currentEaseTo = vi.fn();
    useMapMock.mockReturnValue({
      current: {
        getMap: () => ({
          easeTo: currentEaseTo,
          getZoom: () => 7,
          getPitch: () => 0,
          getMinZoom: () => 0,
          getMaxZoom: () => 22,
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
      default: {
        getMap: () => ({
          easeTo: easeToMock,
          getZoom: getZoomMock,
          getPitch: getPitchMock,
          getMinZoom: getMinZoomMock,
          getMaxZoom: getMaxZoomMock,
          on: onMock,
          off: offMock,
        }),
      },
    });
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(currentEaseTo).toHaveBeenCalledTimes(1);
    expect(currentEaseTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 8 }));
    expect(easeToMock).not.toHaveBeenCalled();
  });

  it('disables every button when neither current nor default is available', () => {
    useMapMock.mockReturnValue({});
    render(<ZoomControls />);
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /tilt up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /tilt down/i })).toBeDisabled();
  });

  it('eases pitch up by 15 deg when the tilt-up button is clicked from flat', () => {
    getPitchMock.mockReturnValue(0);
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /tilt up/i }));
    expect(easeToMock).toHaveBeenCalledTimes(1);
    expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({ pitch: 15 }));
  });

  it('eases pitch up by 15 deg from the current pitch', () => {
    getPitchMock.mockReturnValue(30);
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /tilt up/i }));
    expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({ pitch: 45 }));
  });

  it('clamps pitch to MAP_MAX_PITCH at the upper bound', () => {
    getPitchMock.mockReturnValue(MAP_MAX_PITCH - 5);
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /tilt up/i }));
    expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({ pitch: MAP_MAX_PITCH }));
  });

  it('eases pitch down by 15 deg from the current pitch', () => {
    getPitchMock.mockReturnValue(45);
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /tilt down/i }));
    expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({ pitch: 30 }));
  });

  it('clamps pitch to 0 deg at the lower bound', () => {
    getPitchMock.mockReturnValue(10);
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /tilt down/i }));
    expect(easeToMock).toHaveBeenCalledWith(expect.objectContaining({ pitch: 0 }));
  });

  it('disables zoom-in at maxZoom', () => {
    getZoomMock.mockReturnValue(22);
    render(<ZoomControls />);
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /zoom out/i })).not.toBeDisabled();
  });

  it('disables zoom-out at minZoom', () => {
    getZoomMock.mockReturnValue(0);
    render(<ZoomControls />);
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /zoom in/i })).not.toBeDisabled();
  });

  it('disables tilt-down at pitch 0 and tilt-up at pitch MAP_MAX_PITCH', () => {
    getPitchMock.mockReturnValue(0);
    render(<ZoomControls />);
    expect(screen.getByRole('button', { name: /tilt down/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /tilt up/i })).not.toBeDisabled();
  });

  it('refreshes disabled state when the map fires zoomend/pitchend', () => {
    getZoomMock.mockReturnValue(10);
    getPitchMock.mockReturnValue(30);
    render(<ZoomControls />);
    expect(screen.getByRole('button', { name: /zoom in/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /tilt up/i })).not.toBeDisabled();

    getZoomMock.mockReturnValue(22);
    getPitchMock.mockReturnValue(MAP_MAX_PITCH);
    const handler = getViewChangeHandler();
    expect(handler).toBeDefined();
    act(() => {
      handler?.();
    });

    expect(screen.getByRole('button', { name: /zoom in/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /tilt up/i })).toBeDisabled();
  });
});
