import type { ScopeRenderer } from '../scope/renderer.js';
import type { ScopeTheme } from '../styles/theme.js';

/**
 * One view style of the scope: how it paints, and what it looks like. A mode
 * is self-contained - everything specific to it lives in its own directory
 * under `modes/` - so adding a view style means adding a directory and one
 * entry in the registry, without touching the canvas, the chrome, or the app.
 */
export interface ScopeModeDefinition {
  /** Stable identifier, used wherever a mode is selected or stored. */
  id: string;
  /** Human-readable name. */
  label: string;
  /** The mode's colors and type, for both its renderer and the chrome around it. */
  theme: ScopeTheme;
  /** Creates a fresh renderer for this mode. Called once each time the mode is switched to. */
  createRenderer(): ScopeRenderer;
}
