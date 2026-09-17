import { describe, expect, it } from 'vitest';

import {
  clampWindowStart,
  FOOTER_ROWS,
  HOTKEY_BAR_ROWS,
  isWindowed,
  mainPanelRows,
  planWindow,
  STATUS_BAR_ROWS,
  windowLabel,
} from './viewport.js';

describe('mainPanelRows', () => {
  it('is undefined when the terminal height is unknown', () => {
    expect(
      mainPanelRows({
        terminalRows: undefined,
        showStatus: true,
        promptRows: 0,
        messagesRows: 0,
        statsRows: 0,
      }),
    ).toBeUndefined();
  });

  it('subtracts the status bar, hotkey bar, prompt, and open panels', () => {
    expect(
      mainPanelRows({
        terminalRows: 40,
        showStatus: true,
        promptRows: 2,
        messagesRows: 11,
        statsRows: 6,
      }),
    ).toBe(40 - STATUS_BAR_ROWS - HOTKEY_BAR_ROWS - 2 - 11 - 6);
    expect(
      mainPanelRows({
        terminalRows: 40,
        showStatus: false,
        promptRows: 0,
        messagesRows: 0,
        statsRows: 0,
      }),
    ).toBe(40 - HOTKEY_BAR_ROWS);
  });

  it('never goes below one row', () => {
    expect(
      mainPanelRows({
        terminalRows: 3,
        showStatus: true,
        promptRows: 2,
        messagesRows: 11,
        statsRows: 0,
      }),
    ).toBe(1);
  });
});

describe('clampWindowStart', () => {
  it('leaves the window alone while the cursor is inside it', () => {
    expect(clampWindowStart(10, 15, 100, 10)).toBe(10);
  });

  it('scrolls up just enough when the cursor is above the window', () => {
    expect(clampWindowStart(10, 4, 100, 10)).toBe(4);
  });

  it('scrolls down just enough when the cursor is below the window', () => {
    expect(clampWindowStart(10, 25, 100, 10)).toBe(16);
  });

  it('clamps to the list without a cursor', () => {
    expect(clampWindowStart(95, -1, 100, 10)).toBe(90);
    expect(clampWindowStart(-3, -1, 100, 10)).toBe(0);
    expect(clampWindowStart(5, -1, 4, 10)).toBe(0);
  });
});

describe('planWindow', () => {
  it('shows everything when the rows fit or the capacity is unknown', () => {
    expect(planWindow(20, 20, 5, 3)).toEqual({ start: 0, visibleRows: Number.POSITIVE_INFINITY });
    expect(planWindow(20, undefined, 5, 3)).toEqual({
      start: 0,
      visibleRows: Number.POSITIVE_INFINITY,
    });
  });

  it('reserves a footer row and keeps the cursor visible when windowed', () => {
    const window = planWindow(100, 10, 0, 30);
    expect(window.visibleRows).toBe(10 - FOOTER_ROWS);
    expect(window.start).toBe(30 - 9 + 1);
  });

  it('always shows at least one row', () => {
    expect(planWindow(100, 1, 0, 0).visibleRows).toBe(1);
  });
});

describe('isWindowed / windowLabel', () => {
  it('reports and labels a partial window', () => {
    const window = planWindow(118, 30, 11, 20);
    expect(isWindowed(window, 118)).toBe(true);
    expect(windowLabel(window, 118, 'rows')).toBe('rows 12-40 of 118');
  });

  it('caps the label at the list length', () => {
    expect(windowLabel({ start: 110, visibleRows: 29 }, 118, 'rows')).toBe('rows 111-118 of 118');
    expect(windowLabel({ start: 0, visibleRows: 29 }, 0, 'rows')).toBe('rows 0-0 of 0');
  });

  it('reports a full window as not windowed', () => {
    expect(isWindowed(planWindow(5, 30, 0, 0), 5)).toBe(false);
  });
});
