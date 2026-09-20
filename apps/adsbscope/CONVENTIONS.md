# adsbscope conventions

The patterns that keep `adsbscope` easy to change. They add to the repo-wide [CONVENTIONS.md](../../CONVENTIONS.md), whose cross-cutting rules (TSDoc, naming, unit suffixes, code style) apply here too; this file covers only what is specific to this app. For what the app does and how to run it, see its [README](README.md).

## Two halves, one wire protocol

The package is a Node CLI and server (`src/server/`) and a browser UI (`src/ui/`). They share exactly one thing: `src/shared/protocol.ts`, which defines every path, event name, and payload type that crosses between them. Neither half imports from the other.

- **Everything geographic is resolved on the server.** Aircraft and map features alike reach the browser as bearing and range from the receiver. The browser bundle contains no geodesy, no `@squawk/*` runtime code, and none of the FAA data.
- **Anything both halves must agree on is a constant in the protocol**, never a string written twice: API paths, the snapshot event name, mode ids, range limits, and validators such as `isScopeModeId` and `isIcaoHex`.

## Server

- **Never call `process.exit()`.** `run()` returns an exit code or a running scope, and the entry point sets `process.exitCode`. The lint rule `n/no-process-exit` is an error in `src/server/`.
- **Validate every input at the edge, and bound everything a request can grow.** The server answers only GET and HEAD, checks the `Host` header, serves static files through a traversal-safe resolver, and validates each parameter as strictly as the matching command-line flag (a range is a number up to `MAX_RANGE_NM`; an aircraft is a six-digit ICAO hex). A cache keyed by request input has a fixed maximum size.
- **Bundled data is loaded on demand.** The data packages parse their snapshots as they are imported, so they are imported dynamically, the first time they are needed or just after the server starts listening - never at the top of a module the CLI loads, so that `--help` stays instant. A load that fails is reported once and the scope carries on without that data.
- **Collaborators are injected.** `run()` takes its feed, server, and data providers as dependencies, and the providers take their loaders, so specs run without sockets, files, or the real datasets.

## UI

### Color, type, and size

- **One source of truth for color and type.** Each view style's `ScopeTheme` holds every color and the font. Renderers read it directly (a canvas cannot cheaply read CSS custom properties), and its HTML colors are published as `--scope-ui-*` and `--scope-font-*` custom properties. Stylesheets contain no literal colors or font names; `styles/theme.spec.ts` fails if one appears, or if a stylesheet and the theme disagree about a variable name.
- **rem, not px.** Stylesheets size everything in rem. Canvas sizes are authored in rem too (`DIGITAL_LAYOUT_REM`, `ANALOG_LAYOUT_REM`, and the like) and converted with the root font size at draw time, so the scope follows the user's font size and browser zoom. A `Px` suffix marks a value that is genuinely in canvas pixels, such as a hairline width.
- **Mobile first, one breakpoint.** Base styles target a phone; `min-width: 48rem` restores the compact desktop sizing. Below it, interactive controls are at least 2.75rem square.
- **Layout tokens are global, component styles are local.** Spacing, insets, and control sizes are custom properties in `styles/global.css`. Everything else lives beside its component as a CSS Module (`status-bar.module.css` next to `status-bar.tsx`).

### Structure

- **Pure logic lives in `.ts`, components in `.tsx`, one component per file.** Anything that can be a pure function is one - data-block formatting and placement, hit-testing, range steps, hotkey resolution, URL state, list contents - and is unit-tested without rendering.
- **Data loading follows one shape.** A `data/<thing>.ts` module holds the URL builder, a lenient parser, and a fetch that resolves to `undefined` rather than throwing; a `data/use-<thing>.ts` hook owns the request lifecycle and ignores a response that arrives after its input has changed. `ScopeView` takes each loader as a prop so specs never touch the network.

### View styles

- **A view style is self-contained.** Adding one means adding its id to `SCOPE_MODE_IDS` in the protocol, a `modes/<mode>/` directory with a `ScopeModeDefinition` (renderer factory, theme, extent, settings), and one entry in `modes/registry.ts`. The registry and the per-mode state are typed as complete records, so the compiler points at every place that needs the new id.
- **Mode settings are data.** A view style declares what the user can adjust as `ModeSetting`s (id, label, hotkey, choices; the first choice is the default). The HUD renders a selector per setting and wires the hotkey without knowing what any setting means; only that view style's renderer reads the value. `modes/registry.spec.ts` checks that hotkeys do not collide with each other or with the global keys.
- **What view styles share is drawn once.** Range rings, the compass rose, the video map, data-block formatting and placement, and hit-testing are shared modules under `scope/`, so the picture lines up exactly when the style is switched. A view style's `extent` says how far its scope reaches, and both the video map and hit-testing read it.
- **Renderers keep state, not pixels.** A renderer redraws the whole frame every time. Anything that persists between frames - the analog style's fading returns, the direction each data block was placed in - is kept as data and drawn from that data, rather than by fading or reusing the canvas, which leaves permanent ghosting in 8-bit color and cannot survive a resize or a range change. `reset()` forgets it.
- **Work that depends on the snapshot runs once per snapshot, not once per frame.** Frames are painted at the display's refresh rate; snapshots arrive once a second. Placement and similar work is memoized on what it was computed from.

### Controls

- **Choices are shown as selectors, never as a single toggle button.** A lone button labelled `Analog` can be read as "you are in analog" or as "press for analog", and no wording fixes that for everyone. `hud/segmented-control.tsx` shows every option with the selected one marked (`aria-pressed`), so state and action are both visible. A selector's button selects its option; its hotkey steps to the next one.
- **Plain actions stay plain buttons**, and a button that shows or hides something is a disclosure button: its label is the action it will perform (`Hide controls`, `Show controls`) and it carries `aria-expanded`.
- **Every row in a control group is captioned, and anything that is not a captioned selector lines up with the options column.** Rows that start at different left edges read as disorganized.
- **Everything reachable by pointer is reachable by key**, and the reverse. Keys held with Ctrl, Alt, or Cmd are left to the browser.

### Accessibility and tests

- Query by role and accessible name in component specs, as a user of assistive technology would find the element; lists and panels are labelled regions, and the emergency list is an alert.
- A recording stand-in for the 2D context (`scope/test-utils.ts`) lets renderer specs assert on what was drawn. It models `save` and `restore`, because `restore()` resets styles on a real canvas and a spec should catch a style that was only ever set inside a saved block.
