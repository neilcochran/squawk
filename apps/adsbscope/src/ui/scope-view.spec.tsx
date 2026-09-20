// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScopeConfig } from '../shared/protocol.js';

import { LINK_STATUS_LABELS } from './hud/link-status.js';
import { TAB_LIST_LABEL } from './hud/tab-list.js';
import { SCOPE_MODES_BY_ID } from './modes/registry.js';
import { makeSnapshot, makeTarget } from './scope/test-utils.js';
import { ScopeView } from './scope-view.js';
import { themeCssVariables } from './styles/theme.js';
import type { ScopeTheme } from './styles/theme.js';
import { FakeEventSource } from './test-utils.js';

const CONFIG: ScopeConfig = {
  receiver: { lat: 40.6413, lon: -73.7781 },
  source: 'beast',
  station: '192.168.1.50:30005',
  mode: 'digital',
  rangeNm: 60,
};

const { digital: DIGITAL, analog: ANALOG } = SCOPE_MODES_BY_ID;
const loadVideoMap = vi.fn((rangeNm: number) =>
  Promise.resolve({ rangeNm, points: [], lines: [] }),
);

function expectThemeApplied(theme: ScopeTheme): void {
  for (const [name, value] of Object.entries(themeCssVariables(theme))) {
    expect(document.documentElement.style.getPropertyValue(name)).toBe(value);
  }
}

/** Asserts that the named option is the selected one of its control. */
function expectSelected(name: string): void {
  expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
}

beforeEach(() => {
  loadVideoMap.mockClear();
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
  it('renders the scope canvas, the status readout, and both groups of controls', () => {
    render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);

    expect(screen.getByLabelText('Radar scope')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('range 60 nm');
    expect(screen.getByRole('group', { name: 'Scope range' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'View style' })).toBeInTheDocument();
  });

  describe('view style', () => {
    it('starts in the configured view style, themed to match', () => {
      render(<ScopeView config={{ ...CONFIG, mode: 'analog' }} loadVideoMap={loadVideoMap} />);

      expectSelected('View style: Analog');
      expectThemeApplied(ANALOG.theme);
    });

    it('selects the view style whose button is pressed, re-theming the page and swapping the settings', () => {
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);
      expectSelected('View style: Digital');
      expectThemeApplied(DIGITAL.theme);
      expect(screen.queryByRole('group', { name: 'Tags' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'View style: Analog' }));

      expectSelected('View style: Analog');
      expect(screen.getByRole('group', { name: 'Tags' })).toBeInTheDocument();
      expectThemeApplied(ANALOG.theme);

      fireEvent.click(screen.getByRole('button', { name: 'View style: Digital' }));

      expectSelected('View style: Digital');
      expectThemeApplied(DIGITAL.theme);
    });

    it('stays put when the view style already selected is pressed again', () => {
      const createDigital = vi.spyOn(DIGITAL, 'createRenderer');
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);

      fireEvent.click(screen.getByRole('button', { name: 'View style: Digital' }));

      expectSelected('View style: Digital');
      expect(createDigital).toHaveBeenCalledTimes(1);
    });

    it('steps to the next view style from the keyboard', () => {
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);

      fireEvent.keyDown(window, { key: 'm' });
      expectSelected('View style: Analog');

      fireEvent.keyDown(window, { key: 'm' });
      expectSelected('View style: Digital');
    });

    it('creates a fresh renderer each time a view style is switched to, not on every render', () => {
      const createAnalog = vi.spyOn(ANALOG, 'createRenderer');
      const createDigital = vi.spyOn(DIGITAL, 'createRenderer');
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);
      expect(createDigital).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: '+' });
      expect(createDigital).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'm' });
      fireEvent.keyDown(window, { key: 't' });
      expect(createAnalog).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'm' });
      fireEvent.keyDown(window, { key: 'm' });
      expect(createAnalog).toHaveBeenCalledTimes(2);
    });
  });

  describe('mode settings', () => {
    it('selects a setting value from its button', () => {
      render(<ScopeView config={{ ...CONFIG, mode: 'analog' }} loadVideoMap={loadVideoMap} />);
      expectSelected('Tags: On');

      fireEvent.click(screen.getByRole('button', { name: 'Tags: Off' }));
      expectSelected('Tags: Off');

      fireEvent.click(screen.getByRole('button', { name: 'Sweep: 12 s' }));
      expectSelected('Sweep: 12 s');
      expectSelected('Tags: Off');
    });

    it("steps a setting to its next value from the setting's hotkey", () => {
      render(<ScopeView config={{ ...CONFIG, mode: 'analog' }} loadVideoMap={loadVideoMap} />);

      fireEvent.keyDown(window, { key: 't' });
      expectSelected('Tags: Off');

      fireEvent.keyDown(window, { key: 't' });
      expectSelected('Tags: On');

      fireEvent.keyDown(window, { key: 'r' });
      expectSelected('Sweep: 12 s');
    });

    it("ignores a setting's hotkey in a mode that does not declare it, and with Ctrl held", () => {
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);

      fireEvent.keyDown(window, { key: 't' });
      fireEvent.keyDown(window, { key: 'm' });
      fireEvent.keyDown(window, { key: 'r', ctrlKey: true });

      expectSelected('Tags: On');
      expectSelected('Sweep: 4.8 s');
    });

    it("keeps a mode's settings while another mode is showing", () => {
      render(<ScopeView config={{ ...CONFIG, mode: 'analog' }} loadVideoMap={loadVideoMap} />);
      fireEvent.click(screen.getByRole('button', { name: 'Tags: Off' }));

      fireEvent.click(screen.getByRole('button', { name: 'View style: Digital' }));
      fireEvent.click(screen.getByRole('button', { name: 'View style: Analog' }));

      expectSelected('Tags: Off');
    });
  });

  describe('range', () => {
    it('steps from the on-screen buttons', () => {
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);

      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(screen.getByRole('status')).toHaveTextContent('range 40 nm');

      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      expect(screen.getByRole('status')).toHaveTextContent('range 80 nm');
    });

    it('steps from the keyboard and ignores keys that mean nothing', () => {
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);

      fireEvent.keyDown(window, { key: '+' });
      expect(screen.getByRole('status')).toHaveTextContent('range 40 nm');

      fireEvent.keyDown(window, { key: 'x' });
      expect(screen.getByRole('status')).toHaveTextContent('range 40 nm');
    });

    it('starts from a configured range that is not one of the steps, and survives a mode switch', () => {
      render(<ScopeView config={{ ...CONFIG, rangeNm: 25 }} loadVideoMap={loadVideoMap} />);
      expect(screen.getByRole('status')).toHaveTextContent('range 25 nm');

      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      fireEvent.keyDown(window, { key: 'm' });

      expect(screen.getByRole('status')).toHaveTextContent('range 20 nm');
    });
  });

  describe('video map', () => {
    it('loads the map for the starting range, then for each range stepped to', async () => {
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(loadVideoMap.mock.calls).toEqual([[60]]);

      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(loadVideoMap.mock.calls).toEqual([[60], [40]]);
    });

    it('does not reload the map when only the view style or a setting changes', async () => {
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);

      fireEvent.keyDown(window, { key: 'm' });
      fireEvent.keyDown(window, { key: 't' });
      await act(async () => {
        await Promise.resolve();
      });

      expect(loadVideoMap).toHaveBeenCalledTimes(1);
    });

    it('offers the map setting in every view style, each keeping its own choice', () => {
      render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);
      expectSelected('Map: Basic');

      fireEvent.keyDown(window, { key: 'v' });
      expectSelected('Map: Full');

      fireEvent.keyDown(window, { key: 'm' });
      expectSelected('Map: Basic');

      fireEvent.keyDown(window, { key: 'v' });
      fireEvent.keyDown(window, { key: 'v' });
      expectSelected('Map: Off');

      fireEvent.keyDown(window, { key: 'm' });
      expectSelected('Map: Full');
    });
  });

  it('reflects the stream in the status readout', () => {
    render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);
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

  it('lists the aircraft that cannot be plotted in the tab list', () => {
    render(<ScopeView config={CONFIG} loadVideoMap={loadVideoMap} />);
    const snapshot = makeSnapshot([
      makeTarget({ position: { trueBearingDeg: 90, rangeNm: 12 } }),
      makeTarget({ icaoHex: 'c0ffee' }),
    ]);
    expect(screen.queryByRole('region', { name: TAB_LIST_LABEL })).not.toBeInTheDocument();

    act(() => {
      FakeEventSource.latest().emitOpen();
      FakeEventSource.latest().emit('snapshot', JSON.stringify(snapshot));
    });

    expect(screen.getByRole('region', { name: TAB_LIST_LABEL })).toHaveTextContent('C0FFEE');
  });
});
