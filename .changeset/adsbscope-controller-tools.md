---
'@squawk/adsbscope': minor
---

### Added

- A `Vector` setting (`P`), in the digital style, that stretches the velocity vector to two or four minutes of flight instead of one, so a converging pair shows up sooner at the cost of a busier picture.
- A `Leader` setting (`L`), in both view styles, that doubles the length of the leader lines to data blocks and tags, which holds a block further clear of the trail and vector behind a fast aircraft.
- A `Ring` setting (`J`), in both view styles, that draws a 3 or 5 nm halo around the selected aircraft - the J-ring of a real scope - for judging separation by eye. It is drawn to scale, so it follows the range, and in the analog style it sits on the aircraft's most recent return, as the selection ring does.
- A pointer readout under the status corner: while the mouse is over the scope, a `cursor` line reads its bearing and range from the receiver, the trackball readout of a real scope. It reads the scope's geometry rather than the traffic, so it works over empty scope and beyond the outermost ring. A touch screen has no pointer, so the line never appears there.
