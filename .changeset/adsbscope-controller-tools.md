---
'@squawk/adsbscope': minor
---

### Added

- A `Vector` setting (`P`), in the digital style, that stretches the velocity vector to two or four minutes of flight instead of one, so a converging pair shows up sooner at the cost of a busier picture.
- A `Leader` setting (`L`), in both view styles, that doubles the length of the leader lines to data blocks and tags, which holds a block further clear of the trail and vector behind a fast aircraft.
- A `Ring` setting (`J`), in both view styles, that draws a 3 or 5 nm halo around the selected aircraft - the J-ring of a real scope - for judging separation by eye. It is drawn to scale, so it follows the range, and in the analog style it sits on the aircraft's most recent return, as the selection ring does.
- A pointer readout under the status corner: while the mouse is over the scope, a `cursor` line reads its bearing and range from the receiver, the trackball readout of a real scope. It reads the scope's geometry rather than the traffic, so it works over empty scope and beyond the outermost ring. A touch screen has no pointer, so the line never appears there.
- A range/bearing line, started with `B` or the `Measure` button under the selectors, for reading the bearing and distance between any two aircraft or points on the scope. With an aircraft selected the line starts from it and the next click or tap is the far end; otherwise the next two clicks are the two ends. An end on an aircraft follows it as it moves, an end on empty scope stays put, and until the far end is picked the line runs to the pointer so a distance can be read before it is fixed. The readout corner says which end the line is waiting for, then reads what it measures (`measure 115 true, 42.6 nm`), and the line carries a `115/42.6` label on the scope. It survives a change of view style or range, is dropped when an aircraft it is anchored to stops being tracked, and clears with the button (then reading `Stop measuring`), `B` again, or `Esc`, which now clears a line before it clears the selection.
