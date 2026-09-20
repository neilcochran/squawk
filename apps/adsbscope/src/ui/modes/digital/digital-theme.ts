import { SCOPE_FONT_FAMILY, SCOPE_FONT_SIZE_REM } from '../../styles/theme.js';
import type { ScopeTheme } from '../../styles/theme.js';

/**
 * The `digital` view style's colors and type: a modern scope, white-green
 * targets on near-black. Airspace boundaries follow the sectional chart
 * convention - Class B blue, Class C magenta - kept dim so they sit behind
 * the traffic.
 */
export const DIGITAL_THEME: ScopeTheme = {
  canvas: {
    background: '#02060a',
    map: '#2f4a3c',
    mapLabel: '#4f7a63',
    airspaceClassB: '#2f5fa8',
    airspaceClassC: '#8a3f7c',
    airspaceClassD: '#2f7f86',
    airspaceSpecialUse: '#8a5f2f',
    videoMapFeature: '#5a8099',
    videoMapLabel: '#466577',
    target: '#e6f2e6',
    coasting: '#7d8a7d',
    history: '#3f7fe0',
    vector: '#c8d4c8',
  },
  ui: {
    background: '#02060a',
    text: '#9fc4ad',
    emphasis: '#e6f2e6',
    ok: '#6fdc8c',
    alert: '#ffb454',
    controlBackground: '#0b1712',
    controlBorder: '#4f7a63',
  },
  fontFamily: SCOPE_FONT_FAMILY,
  fontSizeRem: SCOPE_FONT_SIZE_REM,
};
