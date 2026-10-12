---
'@squawk/airspace': minor
---

### Changed

- `query()` honours exclusive bounds and exclusions. A bound marked `inclusive: false` no longer matches its own value, so a query at exactly 18,000 ft returns Class A without the MOA or Class E area that ends there, and a feature is not returned when the position and altitude fall inside one of its `exclusions`. The other lookups return features with their exclusions attached.
