---
'@squawk/mcp': patch
---

### Changed

- `find_procedures_by_airport_and_runway` matches both-parallels (`RW04B`) and `ALL` runway transitions and runway-specific common routes. The flight plan tools merge a SID or STAR's transition from the adjacent fix and report a procedure that cannot be expanded as unresolved. The tool descriptions explain the behaviour.
