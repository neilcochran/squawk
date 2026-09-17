/**
 * Row budgeting for a terminal that is shorter than the UI. Ink redraws
 * the whole tree every frame and cannot erase lines that have scrolled
 * above the terminal's top, so output taller than the terminal fights the
 * terminal's own scrollback. Every tall panel therefore renders only a
 * window of its rows sized to the space left after the fixed chrome, and
 * keys move the window.
 */

/** Rows the status bar occupies when shown: the summary line and the chip line. */
export const STATUS_BAR_ROWS = 2;

/**
 * Rows reserved for the hotkey bar. It wraps onto a second line in
 * anything narrower than about 120 columns, and its labels change with
 * state, so two rows are reserved rather than measured - one wasted row on
 * a wide terminal beats a clipped bottom border on a narrow one.
 */
export const HOTKEY_BAR_ROWS = 2;

/** Rows the `[S]earch` prompt occupies while open. */
export const SEARCH_BAR_ROWS = 1;

/** Rows the `[F]ilter` prompt occupies while open: the prompt and the hint or error line. */
export const FILTER_BAR_ROWS = 2;

/** Rows a bordered main panel spends beyond its data rows: top border, header or title, bottom border. */
export const PANEL_CHROME_ROWS = 3;

/** Rows a windowed panel's `rows 12-40 of 118` footer occupies. */
export const FOOTER_ROWS = 1;

/** Which rows of a list a windowed panel renders. */
export interface RowWindow {
  /** Index of the first rendered row. */
  start: number;
  /** How many rows are rendered from `start`. Infinite when the panel is not windowed. */
  visibleRows: number;
}

/** Inputs for {@link mainPanelRows}. */
export interface MainPanelBudget {
  /** The terminal's height in rows, or undefined when stdout does not report one. */
  terminalRows: number | undefined;
  /** Whether the status bar is shown. */
  showStatus: boolean;
  /** Rows taken by an open search or filter prompt, or zero. */
  promptRows: number;
  /** Rows taken by the messages panel, or zero when hidden. */
  messagesRows: number;
  /** Rows taken by the stats panel, or zero when hidden. */
  statsRows: number;
}

/**
 * Rows left for the main panel (table, detail view, and so on) after the
 * fixed chrome and any open panels.
 *
 * @param budget - The terminal height and what else is on screen.
 * @returns The rows available, at least one, or undefined when the terminal height is unknown and nothing should be windowed.
 */
export function mainPanelRows(budget: MainPanelBudget): number | undefined {
  if (budget.terminalRows === undefined) {
    return undefined;
  }
  const chrome =
    (budget.showStatus ? STATUS_BAR_ROWS : 0) +
    HOTKEY_BAR_ROWS +
    budget.promptRows +
    budget.messagesRows +
    budget.statsRows;
  return Math.max(1, budget.terminalRows - chrome);
}

/**
 * Moves a window's start the minimum needed to keep `cursorIndex` inside
 * it, then clamps it to the list. A cursor of `-1` (nothing selected) only
 * clamps, so the window stays put while the list changes underneath.
 *
 * @param start - The current window start.
 * @param cursorIndex - Index of the row that must stay visible, or -1 for none.
 * @param total - Rows in the list.
 * @param visibleRows - Rows the window shows.
 * @returns The adjusted start.
 */
export function clampWindowStart(
  start: number,
  cursorIndex: number,
  total: number,
  visibleRows: number,
): number {
  let next = start;
  if (cursorIndex >= 0) {
    if (cursorIndex < next) {
      next = cursorIndex;
    } else if (cursorIndex >= next + visibleRows) {
      next = cursorIndex - visibleRows + 1;
    }
  }
  const maxStart = Math.max(0, total - visibleRows);
  return Math.min(Math.max(0, next), maxStart);
}

/**
 * Plans a panel's window: everything when the rows fit (or the terminal
 * height is unknown), otherwise a slice sized to the capacity minus the
 * footer that tells the user rows are hidden, positioned to keep the
 * cursor visible.
 *
 * @param total - Rows in the list.
 * @param capacityRows - Rows the panel can spend on data plus footer, or undefined for unlimited.
 * @param start - The current window start.
 * @param cursorIndex - Index of the row that must stay visible, or -1 for none.
 * @returns The window to render.
 */
export function planWindow(
  total: number,
  capacityRows: number | undefined,
  start: number,
  cursorIndex: number,
): RowWindow {
  if (capacityRows === undefined || total <= capacityRows) {
    return { start: 0, visibleRows: Number.POSITIVE_INFINITY };
  }
  const visibleRows = Math.max(1, capacityRows - FOOTER_ROWS);
  return { start: clampWindowStart(start, cursorIndex, total, visibleRows), visibleRows };
}

/**
 * Whether a window hides part of a list of `total` rows.
 *
 * @param window - The window.
 * @param total - Rows in the list.
 * @returns True when fewer than `total` rows are rendered.
 */
export function isWindowed(window: RowWindow, total: number): boolean {
  return window.visibleRows < total;
}

/**
 * The footer text for a windowed panel, e.g. `rows 12-40 of 118`.
 *
 * @param window - The window.
 * @param total - Rows in the list.
 * @param noun - What the rows are called: `rows` or `lines`.
 * @returns The one-based range and the total.
 */
export function windowLabel(window: RowWindow, total: number, noun: string): string {
  const first = Math.min(total, window.start + 1);
  const last = Math.min(total, window.start + window.visibleRows);
  return `${noun} ${first}-${last} of ${total}`;
}
