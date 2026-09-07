---
'@squawk/adsbtop': patch
---

### Fixed

- The published tarball now contains the compiled `dist/` output. 0.4.0 shipped with only `package.json` and `README.md`, leaving the package installable but with no runnable code and no working `adsbtop` command.
- Test helpers are no longer included in the published package.
