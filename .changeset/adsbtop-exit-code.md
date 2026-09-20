---
'@squawk/adsbtop': patch
---

### Fixed

- Usage and error output can no longer be cut short when piped or redirected. `--help` and an unusable command line now set an exit code and return instead of ending the process immediately, so writes that are asynchronous on pipes and Windows terminals have all landed before adsbtop exits.
