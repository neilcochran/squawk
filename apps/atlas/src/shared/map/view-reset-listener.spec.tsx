import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchViewReset } from './view-reset-bus.ts';
import { ViewResetListener } from './view-reset-listener.tsx';
import { MAP_VIEW_DEFAULTS } from './view-state-schema.ts';

const { useMapMock, easeToMock } = vi.hoisted(() => ({
  useMapMock: vi.fn(),
  easeToMock: vi.fn(),
}));

vi.mock('@vis.gl/react-maplibre', () => ({ useMap: useMapMock }));

describe('ViewResetListener', () => {
  beforeEach(() => {
    easeToMock.mockReset();
    useMapMock.mockReturnValue({ current: { getMap: () => ({ easeTo: easeToMock }) } });
  });

  it('eases the map to the default view on a reset dispatch', () => {
    render(<ViewResetListener />);
    dispatchViewReset();
    expect(easeToMock).toHaveBeenCalledTimes(1);
    expect(easeToMock.mock.calls[0]?.[0]).toMatchObject({
      center: [MAP_VIEW_DEFAULTS.lon, MAP_VIEW_DEFAULTS.lat],
      zoom: MAP_VIEW_DEFAULTS.zoom,
      pitch: MAP_VIEW_DEFAULTS.pitch,
    });
  });

  it('falls back to the default map registered with the provider', () => {
    useMapMock.mockReturnValue({ default: { getMap: () => ({ easeTo: easeToMock }) } });
    render(<ViewResetListener />);
    dispatchViewReset();
    expect(easeToMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing before a map is available', () => {
    useMapMock.mockReturnValue({});
    render(<ViewResetListener />);
    dispatchViewReset();
    expect(easeToMock).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const { unmount } = render(<ViewResetListener />);
    unmount();
    dispatchViewReset();
    expect(easeToMock).not.toHaveBeenCalled();
  });
});
