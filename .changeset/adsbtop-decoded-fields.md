---
'@squawk/adsbtop': minor
---

### Added

- Detail view: five new rows for the phase-5 decoded fields - `Squawk alert`, `Ident active`, `Emergency state`, `Resolution advisory`, and `Target state` (selected altitude/heading and autopilot status).
- README "Field population by source" table showing which of JSON/SBS/Beast populate those five fields; the `--help` usage text and the `H`elp overlay both note the same coverage difference.

### Changed

- Aircraft squawking an emergency code, declaring an emergency state, or carrying an active ACAS/TCAS Resolution Advisory all render their row in bold red - previously only the emergency squawk code triggered this.
