---
'@squawk/flightplan': minor
---

### Added

- `sid` and `star` route elements carry `transition`, the name of the transition merged into `legs`.

### Changed

- A SID or STAR token without a dotted transition takes its transition from the adjacent fix when the procedure publishes one by that name: the token after a SID or the waypoint before a STAR (`KJFK DEEZZ6 CANDR`), which is how routes are filed. Previously only the common route was expanded, and the 918 SIDs and STARs that CIFP publishes as transitions only came back with no legs at all.
- A procedure that cannot be expanded, because the dotted transition is not one it publishes or it is transition-only with no adjacent fix naming a transition, is marked `unresolved`, like an airway that cannot be expanded, instead of appearing as a `sid` or `star` element with empty legs that `computeRouteDistance` skipped silently.
