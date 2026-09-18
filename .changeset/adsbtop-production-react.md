---
'@squawk/adsbtop': patch
---

### Fixed

- Memory no longer grows for the whole session. adsbtop ran React's development build, which records a `performance.measure()` entry on every render that Node never evicts, so after roughly ten minutes on a busy feed Node printed a `MaxPerformanceEntryBufferExceededWarning` over the display. adsbtop now defaults `NODE_ENV` to `production` before React loads, which also makes each render cheaper. An explicitly set `NODE_ENV` is left untouched.
