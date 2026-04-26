import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoomControls } from './zoom-controls.tsx';

const { useMapMock, easeToMock, getZoomMock } = vi.hoisted(() => ({
  useMapMock: vi.fn(),
  easeToMock: vi.fn(),
  getZoomMock: vi.fn(),
}));

vi.mock('@vis.gl/react-maplibre', () => ({
  useMap: useMapMock,
}));

describe('ZoomControls', () => {
  beforeEach(() => {
    easeToMock.mockClear();
    getZoomMock.mockClear();
    getZoomMock.mockReturnValue(4);
    // Mirror @vis.gl/react-maplibre's MapCollection: the unnamed Map
    // registers itself under `default`, while `current` is only set when
    // the consumer is rendered inside the Map's context. ZoomControls
    // sits outside `<Map>`, so it must work off `default`.
    useMapMock.mockReturnValue({
      default: {
        getMap: () => ({
          easeTo: easeToMock,
          getZoom: getZoomMock,
        }),
      },
    });
  });

  it('renders the zoom-in and zoom-out buttons', () => {
    render(<ZoomControls />);
    expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
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
      current: { getMap: () => ({ easeTo: currentEaseTo, getZoom: () => 7 }) },
      default: { getMap: () => ({ easeTo: easeToMock, getZoom: getZoomMock }) },
    });
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    expect(currentEaseTo).toHaveBeenCalledTimes(1);
    expect(currentEaseTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 8 }));
    expect(easeToMock).not.toHaveBeenCalled();
  });

  it('does nothing when neither current nor default is available', () => {
    useMapMock.mockReturnValue({});
    render(<ZoomControls />);
    fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));
    fireEvent.click(screen.getByRole('button', { name: /zoom out/i }));
    expect(easeToMock).not.toHaveBeenCalled();
  });
});
