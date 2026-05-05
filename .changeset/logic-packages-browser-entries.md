---
'@squawk/airports': minor
'@squawk/airspace': minor
'@squawk/airways': minor
'@squawk/fixes': minor
'@squawk/navaids': minor
'@squawk/procedures': minor
'@squawk/icao-registry': minor
---

### Added

- `/browser` exports subpath on every query logic package. SPAs and edge runtimes can now `import { create<X>Resolver } from '@squawk/<pkg>/browser'` and pair it with the matching `@squawk/<pkg>-data/browser` async loader for zero-config browser usage. Browser support was already implicit since the resolver factories have no Node-specific imports; the new entry makes it an explicit, `publint`-verified part of the public API surface, so a future Node-only import would have to split the surface intentionally rather than silently breaking SPA bundles.
- For `@squawk/icao-registry`, the `/browser` entry is a strict subset that re-exports `createIcaoRegistry` and the shared types but omits `parseFaaRegistryZip`. The parser depends on Node's `Buffer` and the `adm-zip` package and remains exported from the default entry for Node consumers that want fresh FAA registry data.
- The default (Node) entry on every package is unchanged; existing imports keep working.
