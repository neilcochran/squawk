---
'@squawk/weather': patch
'@squawk/mcp': patch
---

### Fixed

- Hardened `parseAirmet` (and the `parse_airmet` MCP tool that wraps it) against a polynomial-time ReDoS in its section-splitter regex (CodeQL `js/polynomial-redos`, CWE-1333). The previous pattern had two ambiguous `\s*` quantifiers separated by a literal `.`, and `\s` matches `\n` - so on inputs with long newline runs the engine could backtrack every newline assignment at every starting position. A bulletin with ~80k leading newlines pinned the parser thread for ~23 seconds; the replacement uses `[^\S\n]*` (whitespace excluding newline) so the `\n` boundaries anchor unambiguously and completes the same input in under a millisecond. No behavior change for valid AIRMET bulletins.
