---
'@squawk/airport-data': minor
'@squawk/airspace-data': minor
'@squawk/airway-data': minor
'@squawk/fix-data': minor
'@squawk/navaid-data': minor
'@squawk/procedure-data': minor
---

### Added

- A `/meta` export subpath exposing the snapshot's build metadata - cycle date, build
  timestamp, and record counts - as a plain constant. Importing the package itself
  decompresses and parses the whole snapshot, because the metadata and the records come out
  of the same parse, so anything that only wanted to report which cycle it was serving had
  to pay for the entire dataset to find out. `usBundled<X>Properties` from
  `@squawk/<pkg>/meta` reads no files and costs nothing, so it behaves the same in Node and
  in the browser. The values are identical to `usBundled<X>.properties`.
