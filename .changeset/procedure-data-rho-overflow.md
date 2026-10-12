---
'@squawk/procedure-data': patch
---

### Fixed

- `rhoNm` is left unset on the six legs whose source field is saturated at the ARINC maximum of 999.9. The St. George ILS and LOC RWY 11 (`PAPB I11` and `L11`) and the Tununak `EZEPU1` departure name North Dakota VORs about 2,300 nm away as recommended navaids, so the published value was a field overflow, not a distance. Theta and the navaid reference stay as coded; the README describes the six legs, which are coded identically in the preceding CIFP cycle.
