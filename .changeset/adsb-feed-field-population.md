---
'@squawk/adsb-feed': minor
---

### Added

- The JSON source populates `Aircraft.emergencyState` from `aircraft.json`'s `emergency` field.
- The SBS source populates `Aircraft.identActive`/`squawkAlert` from the BaseStation `SPI`/`Alert` fields.
- The Beast source populates `Aircraft.emergencyState`, `identActive`, `squawkAlert`, `resolutionAdvisory` (from either a DF16 reply or an ADS-B broadcast), and `targetState` - all previously decoded by `@squawk/mode-s` but discarded by the mapper.
