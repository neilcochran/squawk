import { SCOPE_FONT_FAMILY, SCOPE_FONT_SIZE_REM } from '../../styles/theme.js';
import type { ScopeCanvasPalette, ScopeTheme } from '../../styles/theme.js';

/** The analog scope's canvas colors: the shared palette plus the beam. */
export interface AnalogCanvasPalette extends ScopeCanvasPalette {
  /** The rotating beam and its afterglow. */
  sweep: string;
}

/** A theme for the analog scope. */
export interface AnalogTheme extends ScopeTheme {
  /** Colors for the scope canvas, including the beam. */
  canvas: AnalogCanvasPalette;
}

/**
 * The `analog` view style's colors and type: a monochrome green phosphor
 * tube. Every class of airspace is the same green; it is their dashes that
 * tell a boundary from a range ring here. Every canvas color is six-digit hex, because the renderer derives
 * the afterglow's translucent variants from them.
 */
export const ANALOG_THEME: AnalogTheme = {
  canvas: {
    background: '#020a04',
    map: '#0f3d1f',
    mapLabel: '#1f6b38',
    airspaceClassB: '#0f4522',
    airspaceClassC: '#0f4522',
    airspaceClassD: '#0f4522',
    airspaceSpecialUse: '#0f4522',
    videoMapFeature: '#1a5c30',
    videoMapLabel: '#164d29',
    target: '#7dffa0',
    coasting: '#7dffa0',
    history: '#7dffa0',
    vector: '#7dffa0',
    sweep: '#3dff7a',
  },
  ui: {
    background: '#020a04',
    text: '#2fb85a',
    emphasis: '#7dffa0',
    ok: '#7dffa0',
    alert: '#e6ff6a',
    controlBackground: '#05160b',
    controlBorder: '#1f6b38',
  },
  fontFamily: SCOPE_FONT_FAMILY,
  fontSizeRem: SCOPE_FONT_SIZE_REM,
};
