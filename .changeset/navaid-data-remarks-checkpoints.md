---
'@squawk/navaid-data': minor
---

### Added

- `remarks` on 1,057 navaids: 1,921 FAA remarks, more than 1,500 of them unusable sectors given by radial, distance and altitude.
- `dmeStatus` on the 552 DME, VOR/DME and NDB/DME facilities where the FAA publishes the DME's status separately. It differs from the navaid's own status on 119 of them.
- `checkpoints`: the 188 VOR receiver checkpoints, on 155 navaids.

### Fixed

- The Thedford VOR/DME (`TDD`) is at its VOR site. The FAA's CSV carries the DME's position in the record's decimal coordinate columns, 0.06 nm away, while the same record's degree, minute and second columns, the FAA's airway data and its procedure data all give the VOR position. The source row was corrected by hand from its own columns before the build, and `dmeLat` / `dmeLon` now carry the DME position.
- Fan markers no longer carry a magnetic variation. The FAA's record layout says a DME, VOT or fan marker has none and that any value published for one is to be ignored; ten fan markers shipped one.

### Changed

- The README documents the limits of the data: shared identifiers, TACAN frequencies outside the VOR band, what the magnetic variation is, how to read a remark, and which FAA columns are not carried.
