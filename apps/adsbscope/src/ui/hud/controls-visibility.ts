/**
 * The media query for a screen wide enough to keep the controls open beside
 * the scope. It is the same `48rem` breakpoint the stylesheets use.
 */
export const WIDE_SCREEN_QUERY = '(min-width: 48rem)';

/** Accessible name and text of the disclosure button while the controls are showing. */
export const HIDE_CONTROLS_LABEL = 'Hide controls';

/** Accessible name and text of the disclosure button while the controls are hidden. */
export const SHOW_CONTROLS_LABEL = 'Show controls';

/** The part of `window.matchMedia` that deciding the starting state needs. */
export type MatchMedia = (query: string) => { matches: boolean };

/**
 * Decides whether the view style and setting controls start out showing. On
 * a wide screen they do; on a narrow one they start hidden, since a phone has
 * no room for them beside the scope, the lists, and the inspect panel all at
 * once. Where the screen cannot be asked about, they show.
 *
 * @param matchMedia - `window.matchMedia`, or undefined where there is none.
 * @returns True if the controls should start out showing.
 */
export function startsWithControlsShowing(matchMedia: MatchMedia | undefined): boolean {
  return matchMedia === undefined || matchMedia(WIDE_SCREEN_QUERY).matches;
}
