---
'@squawk/mcp': patch
---

### Fixed

- Fix the `-p` npx examples under "Enabling the aircraft registry" in the README. Once a second
  package is added via `-p`, npx stops inferring which package to run and needs the actual binary
  name as the trailing command - the documented `-p @squawk/icao-registry-data @squawk/mcp` failed
  outright rather than starting the server. Both the bare and pinned examples now give each package
  its own `-p` and name `squawk-mcp` explicitly.
