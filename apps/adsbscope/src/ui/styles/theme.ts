/** The monospace font stack every built-in view style uses, so data blocks and readouts align in columns. */
export const SCOPE_FONT_FAMILY = 'ui-monospace, Menlo, Consolas, monospace';

/** The font size, in rem, every built-in view style uses. */
export const SCOPE_FONT_SIZE_REM = 0.75;

/** Colors a renderer paints the scope canvas with. Named for what they mean, not what they look like. */
export interface ScopeCanvasPalette {
  /** The scope's backdrop. */
  background: string;
  /** Range rings, compass ticks, and other fixed scope furniture. */
  map: string;
  /** Labels on the scope furniture, and the receiver marker. */
  mapLabel: string;
  /** Video map: Class B airspace boundaries. */
  airspaceClassB: string;
  /** Video map: Class C airspace boundaries. */
  airspaceClassC: string;
  /** Video map: Class D airspace boundaries. */
  airspaceClassD: string;
  /** Video map: restricted and prohibited area boundaries. */
  airspaceSpecialUse: string;
  /** Video map runways and the symbols of airports, navaids, and fixes. */
  videoMapFeature: string;
  /** Video map labels. */
  videoMapLabel: string;
  /** A live target's symbol, leader line, and data block. */
  target: string;
  /** A target that has not been heard from recently. */
  coasting: string;
  /** A target in an emergency, during the lit half of its flash. */
  emergency: string;
  /** The ring around the selected target. */
  selected: string;
  /** History trail dots. */
  history: string;
  /** Velocity vector lines. */
  vector: string;
}

/** Colors of the HTML UI drawn over and around the canvas: the page, the HUD, and notices. */
export interface ScopeUiPalette {
  /** Page background, visible around the canvas and behind notices. */
  background: string;
  /** Default text. */
  text: string;
  /** Emphasized text, such as the app name. */
  emphasis: string;
  /** A healthy status. */
  ok: string;
  /** A status that needs attention. */
  alert: string;
  /** Background of an interactive control. */
  controlBackground: string;
  /** Border of an interactive control, and its focus ring. */
  controlBorder: string;
}

/**
 * Everything visual about one view style, in one place. This is the single
 * source of truth for color and type: renderers read `canvas` and the font
 * fields directly (a canvas cannot cheaply read CSS custom properties), and
 * {@link applyTheme} publishes `ui` and the font fields as CSS custom
 * properties for the stylesheets, which contain no literal colors or fonts
 * of their own.
 */
export interface ScopeTheme {
  /** Colors for the scope canvas. */
  canvas: ScopeCanvasPalette;
  /** Colors for the HTML UI. */
  ui: ScopeUiPalette;
  /** CSS font-family list shared by the canvas and the HTML UI. */
  fontFamily: string;
  /** Font size in rem shared by the canvas and the HTML UI, so both follow the user's browser font-size setting. */
  fontSizeRem: number;
}

/**
 * Builds the CSS `font` shorthand for drawing canvas text in a theme's type.
 * A canvas font has to be given in pixels, so the theme's rem size is
 * converted at the current scale.
 *
 * @param theme - The theme to draw in.
 * @param pxPerRem - CSS pixels per rem.
 * @returns A value for `CanvasRenderingContext2D.font`.
 */
export function canvasFont(theme: ScopeTheme, pxPerRem: number): string {
  return `${theme.fontSizeRem * pxPerRem}px ${theme.fontFamily}`;
}

/**
 * Lists the CSS custom properties a theme publishes. The names here are the
 * contract with the stylesheets, which refer to them with `var(...)`.
 *
 * @param theme - The theme to publish.
 * @returns Custom property names mapped to their values.
 */
export function themeCssVariables(theme: ScopeTheme): Record<string, string> {
  return {
    '--scope-ui-background': theme.ui.background,
    '--scope-ui-text': theme.ui.text,
    '--scope-ui-emphasis': theme.ui.emphasis,
    '--scope-ui-ok': theme.ui.ok,
    '--scope-ui-alert': theme.ui.alert,
    '--scope-ui-control-background': theme.ui.controlBackground,
    '--scope-ui-control-border': theme.ui.controlBorder,
    '--scope-font-family': theme.fontFamily,
    '--scope-font-size': `${theme.fontSizeRem}rem`,
  };
}

/**
 * Publishes a theme's CSS custom properties on an element, normally the
 * document root so the whole page inherits them. Applying another theme later
 * overwrites every property, so switching view styles needs no cleanup.
 *
 * @param element - The element to set the properties on.
 * @param theme - The theme to publish.
 */
export function applyTheme(element: HTMLElement, theme: ScopeTheme): void {
  for (const [name, value] of Object.entries(themeCssVariables(theme))) {
    element.style.setProperty(name, value);
  }
}
