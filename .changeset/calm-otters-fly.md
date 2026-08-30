---
'@squawk/adsb-feed': minor
---

Add @squawk/adsb-feed: live ADS-B aircraft feed from a local dump1090-fa station, normalized into the shared `Aircraft` type and emitted as `aircraft:new` / `aircraft:update` / `aircraft:lost` events. Two sources: `createJsonAircraftFeed` (HTTP-polled `aircraft.json`, browser-safe) and `createSbsAircraftFeed` (persistent SBS/BaseStation socket, Node-only, lower latency).
