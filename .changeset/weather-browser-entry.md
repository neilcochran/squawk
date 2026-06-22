---
'@squawk/weather': minor
---

### Added

- `@squawk/weather` adds a `/browser` export subpath that aliases the main entry, giving SPAs and edge runtimes an explicit, `publint`-verified browser entry point for the parsers. The separate subpath means a future Node-only import added to the main entry would fail the packaging check rather than silently break browser consumers.
- Clarifies browser use of the opt-in `/fetch` layer: the AWC API sends no CORS headers, so the `baseUrl` option is the supported way to route browser requests through a same-origin proxy.
