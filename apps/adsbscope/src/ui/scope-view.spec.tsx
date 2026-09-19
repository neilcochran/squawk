// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScopeConfig } from '../shared/protocol.js';

import { LINK_STATUS_LABELS } from './chrome/link-status.js';
import type { ScopeModeDefinition } from './modes/mode.js';
import { DEFAULT_SCOPE_MODE } from './modes/registry.js';
import { makeSnapshot, makeTarget } from './scope/test-utils.js';
import { ScopeView } from './scope-view.js';
import { themeCssVariables } from './styles/theme.js';
import { FakeEventSource } from './test-utils.js';

const CONFIG: ScopeConfig = {
  receiver: { lat: 40.6413, lon: -73.7781 },
  source: 'beast',
  station: '192.168.1.50:30005',
  rangeNm: 60,
};

beforeEach(() => {
  FakeEventSource.reset();
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('style');
});

describe('ScopeView', () => {
  it('renders the scope canvas, the status readout, and the range controls', () => {
    render(<ScopeView config={CONFIG} mode={DEFAULT_SCOPE_MODE} />);

    expect(screen.getByLabelText('Radar scope')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('range 60 nm');
    expect(screen.getByRole('group', { name: 'Scope range' })).toBeInTheDocument();
  });

  it("publishes the mode's theme on the document root, and the new one when the mode changes", () => {
    const otherMode: ScopeModeDefinition = {
      ...DEFAULT_SCOPE_MODE,
      id: 'other',
      theme: {
        ...DEFAULT_SCOPE_MODE.theme,
        chrome: { ...DEFAULT_SCOPE_MODE.theme.chrome, text: '#33ff66' },
      },
    };
    const root = document.documentElement;

    const view = render(<ScopeView config={CONFIG} mode={DEFAULT_SCOPE_MODE} />);
    for (const [name, value] of Object.entries(themeCssVariables(DEFAULT_SCOPE_MODE.theme))) {
      expect(root.style.getPropertyValue(name)).toBe(value);
    }

    view.rerender(<ScopeView config={CONFIG} mode={otherMode} />);
    expect(root.style.getPropertyValue('--scope-chrome-text')).toBe('#33ff66');
  });

  it('creates one renderer per mode, not one per render', () => {
    const createRenderer = vi.fn(DEFAULT_SCOPE_MODE.createRenderer);
    const mode: ScopeModeDefinition = { ...DEFAULT_SCOPE_MODE, createRenderer };

    const view = render(<ScopeView config={CONFIG} mode={mode} />);
    view.rerender(<ScopeView config={CONFIG} mode={mode} />);

    expect(createRenderer).toHaveBeenCalledTimes(1);
  });

  it('reflects the stream in the status readout', () => {
    render(<ScopeView config={CONFIG} mode={DEFAULT_SCOPE_MODE} />);
    const snapshot = makeSnapshot([
      makeTarget({ position: { trueBearingDeg: 90, rangeNm: 12 } }),
      makeTarget({ icaoHex: 'c0ffee' }),
    ]);
    expect(screen.getByRole('status')).toHaveTextContent(LINK_STATUS_LABELS.connecting);

    act(() => {
      FakeEventSource.latest().emitOpen();
      FakeEventSource.latest().emit('snapshot', JSON.stringify(snapshot));
    });

    expect(screen.getByRole('status')).toHaveTextContent(LINK_STATUS_LABELS.live);
    expect(screen.getByRole('status')).toHaveTextContent('2 targets (1 plotted)');
  });

  it('steps the range from the on-screen buttons', () => {
    render(<ScopeView config={CONFIG} mode={DEFAULT_SCOPE_MODE} />);

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByRole('status')).toHaveTextContent('range 40 nm');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(screen.getByRole('status')).toHaveTextContent('range 80 nm');
  });

  it('steps the range from the keyboard', () => {
    render(<ScopeView config={CONFIG} mode={DEFAULT_SCOPE_MODE} />);

    fireEvent.keyDown(window, { key: '+' });
    expect(screen.getByRole('status')).toHaveTextContent('range 40 nm');

    fireEvent.keyDown(window, { key: 'x' });
    expect(screen.getByRole('status')).toHaveTextContent('range 40 nm');
  });

  it('starts from a configured range that is not one of the steps', () => {
    render(<ScopeView config={{ ...CONFIG, rangeNm: 25 }} mode={DEFAULT_SCOPE_MODE} />);
    expect(screen.getByRole('status')).toHaveTextContent('range 25 nm');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

    expect(screen.getByRole('status')).toHaveTextContent('range 20 nm');
  });
});
