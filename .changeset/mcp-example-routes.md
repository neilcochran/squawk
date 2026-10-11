---
'@squawk/mcp': patch
---

### Fixed

- The `parse_flightplan_route` tool description's example route is `KLAX DCT LAX J60 SAX DCT KJFK` and its dotted procedure example is `DEEZZ6.CANDR`; the previous `KJFK DCT MERIT J60 MARTN DCT KLAX` and `NUBLE4.JJIMY` do not resolve against the bundled data. The `find_procedures_by_identifier` examples replace `NUBLE4` with `DEEZZ6` for the same reason, and the README's example prompt uses the new route.
