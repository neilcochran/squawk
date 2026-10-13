---
'@squawk/airport-data': minor
---

### Fixed

- Frequencies belong to the airport. FRQ.csv rows were matched to an airport by identifier alone, so 790 navaid rows that share an airport's identifier were attached to it (`AAA` carried `329.0 AAA NDB` and `AAT` the paired `116.65/113Y` of its DME), 74 HF rows the FAA publishes in kHz shipped as MHz (`MOB 5696 CG OPS`, `OAK 10057 OAK RADIO`), and the receive-only `R` and on-request `X` qualifiers were lost to the number parser. The snapshot now keeps the rows the FAA lists under the airport (its own, its AWOS/ASOS weather broadcast and the RCO, FSS and radio services serviced to it), converts HF to MHz (`5.696`), keeps the qualifiers as `receiveOnly` and `onRequest`, and drops the 16 rows the FAA publishes twice. Every frequency now falls in a published band.
- `pavementClassification` is populated on the 2,112 rated runways and `rvrLocations` with `hasRvr` on the 986 runway ends that have RVR; both were read from columns that do not exist in the source and never shipped.
- The 7 runway lengths and 9 widths the FAA publishes as `0` are absent instead of zero.
- The traffic pattern altitude ships as `trafficPatternAltitudeFtAgl`. The FAA publishes it in feet above the field; the old field name and its documentation said MSL.

### Added

- Each frequency carries the facility that provides it and its type (tower, TRACON, RCAG, the airport itself, weather, RCO or FSS), the tower and approach call signs, and the FAA remark, including the HF family text the FAA appends to some frequencies themselves.
- The README lists what is carried as published: the `CO4 17R/35L` single-wheel weight limit, the `HFD 02` localizer course and the four military fields whose published course is true, the two runways whose length disagrees with their end coordinates, the variation years of 2030 and 1904, north as both 0 and 360, and the remote communications outlets the FAA lists under an airport up to 20 nm away.
