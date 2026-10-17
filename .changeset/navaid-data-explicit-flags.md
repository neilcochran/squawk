---
'@squawk/navaid-data': patch
---

### Fixed

- The 40 navaids not open to public use carry `publicUse: false` instead of leaving it unset, so they can be told apart from records with no flag. `simultaneousVoice` is `false` where the FAA says no and unset only where it says nothing.
