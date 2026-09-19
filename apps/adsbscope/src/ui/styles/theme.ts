/** Colors a renderer paints the scope canvas with. Named for what they mean, not what they look like. */
export interface ScopeCanvasPalette {
  /** The scope's backdrop. */
  background: string;
  /** Range rings, compass ticks, and other fixed scope furniture. */
  map: string;
  /** Labels on the scope furniture, and the receiver marker. */
  mapLabel: string;
  /** A live target's symbol, leader line, and data block. */
  target: string;
  /** A target that has not been heard from recently. */
  coasting: string;
  /** History trail dots. */
  history: string;
  /** Velocity vector lines. */
  vector: string;
}

/** Colors of the HTML chrome drawn over and around the canvas. */
export interface ScopeChromePalette {
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
 * {@link applyTheme} publishes `chrome` and the font fields as CSS custom
 * properties for the stylesheets, which contain no literal colors or fonts
 * of their own.
 */
export interface ScopeTheme {
  /** Colors for the scope canvas. */
  canvas: ScopeCanvasPalette;
  /** Colors for the HTML chrome. */
  chrome: ScopeChromePalette;
  /** CSS font-family list shared by the canvas and the chrome. */
  fontFamily: string;
  /** Font size in rem shared by the canvas and the chrome, so both follow the user's browser font-size setting. */
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
    '--scope-chrome-background': theme.chrome.background,
    '--scope-chrome-text': theme.chrome.text,
    '--scope-chrome-emphasis': theme.chrome.emphasis,
    '--scope-chrome-ok': theme.chrome.ok,
    '--scope-chrome-alert': theme.chrome.alert,
    '--scope-chrome-control-background': theme.chrome.controlBackground,
    '--scope-chrome-control-border': theme.chrome.controlBorder,
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
