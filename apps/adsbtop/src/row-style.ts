/**
 * How long after an aircraft is first tracked its row renders in the
 * "new" style, so an arrival catches the eye without needing the messages
 * panel open.
 */
export const NEW_HIGHLIGHT_MS = 3_000;

/**
 * The fraction of the feed's stale threshold (`--stale-after`) after which
 * a row with no fresh update dims. Halfway is early enough to make the
 * eventual `aircraft:lost` unsurprising while leaving healthy rows alone
 * when a source merely skips a beat.
 */
export const STALE_DIM_FRACTION = 0.5;

/**
 * Whether a row still counts as newly tracked.
 *
 * @param firstSeenAt - Unix epoch ms the aircraft was first tracked, or undefined if unknown.
 * @param nowMs - The current time.
 * @returns True within {@link NEW_HIGHLIGHT_MS} of `firstSeenAt`.
 */
export function isFreshRow(firstSeenAt: number | undefined, nowMs: number): boolean {
  return firstSeenAt !== undefined && nowMs - firstSeenAt < NEW_HIGHLIGHT_MS;
}

/**
 * Whether a row has gone without an update long enough to dim.
 *
 * @param lastSeenAt - Unix epoch ms the aircraft was last updated.
 * @param nowMs - The current time.
 * @param staleAfterMs - The feed's stale threshold: how long without an update before it drops the aircraft.
 * @returns True once {@link STALE_DIM_FRACTION} of `staleAfterMs` has elapsed since `lastSeenAt`.
 */
export function isStaleRow(lastSeenAt: number, nowMs: number, staleAfterMs: number): boolean {
  return nowMs - lastSeenAt >= staleAfterMs * STALE_DIM_FRACTION;
}

/** The conditions that decide how a table row's text renders. */
export interface RowStyleFlags {
  /** The aircraft is an emergency - see `isEmergencyAircraft`. */
  emergency: boolean;
  /** The row is the cursor row, rendered on a cyan background. */
  selected: boolean;
  /** The aircraft is on the `--watch` list. */
  watched: boolean;
  /** The aircraft was tracked within the last {@link NEW_HIGHLIGHT_MS}. */
  fresh: boolean;
  /** The aircraft has gone {@link STALE_DIM_FRACTION} of the stale threshold without an update. */
  stale: boolean;
}

/** Ink `Text` style props for a table row's cells. Only the props that apply are present, never set to `undefined`. */
export interface RowTextStyle {
  /** Text color, if not the terminal default. */
  color?: string;
  /** Whether the text is bold. */
  bold?: boolean;
  /** Whether the text is dimmed. */
  dimColor?: boolean;
}

/**
 * Resolves a row's text style from its flags, by precedence: emergency red
 * beats everything; the cursor row renders explicit hex black so it reads
 * against its cyan background (bold when also watched, since yellow would
 * not read there); a watched row is bold yellow; a newly tracked row is
 * green; otherwise the terminal default. A stale row is additionally
 * dimmed, except on the cursor row where dimmed black on cyan is not
 * legible.
 *
 * The result only ever contains the props that apply, so a caller can
 * spread it onto `Text` without passing any Ink style prop as `undefined`.
 * `#000000` rather than the named ANSI `black` for the same
 * palette-remapping reason as the table header - see `HeaderCell`.
 *
 * @param flags - The row's conditions.
 * @returns The style props to spread onto the cell's `Text`.
 */
export function rowTextStyle(flags: RowStyleFlags): RowTextStyle {
  const style: RowTextStyle = {};
  if (flags.emergency) {
    style.color = 'red';
    style.bold = true;
  } else if (flags.selected) {
    style.color = '#000000';
    if (flags.watched) {
      style.bold = true;
    }
  } else if (flags.watched) {
    style.color = 'yellow';
    style.bold = true;
  } else if (flags.fresh) {
    style.color = 'green';
  }
  if (flags.stale && !flags.selected) {
    style.dimColor = true;
  }
  return style;
}
