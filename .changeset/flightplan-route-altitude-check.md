---
'@squawk/flightplan': minor
'@squawk/mcp': minor
---

**@squawk/flightplan**

### Added

- `checkRouteAltitudes(route, { altitudeFt, equipment })` checks a route's cruise altitude against the published airway altitudes. Each airway leg is checked against the MEA for the direction flown and the navigation equipment aboard (`conventional`, `gnss`, `dmeDmeIru`) and against the MAA, and each airway fix against its MCA for the direction flown and its MRA. GNSS uses the GNSS MEA where one is published and the conventional MEA otherwise, plus FL180 on US Jet and Q route segments that publish no GNSS MEA. The altitude comes from `altitudeFt` or the route's opening speed/altitude group, and changes at each group attached to a later point. Each leg and point reports `pass`, `fail` or `notDeterminable` with findings explaining why and the values used. Direct, coordinate and procedure legs are not checked, and neither are flight below the MEA down to the MOCA, the cruising altitude for the direction of flight, or procedure altitude constraints.

**@squawk/mcp**

### Added

- `check_route_altitudes` checks a route string's cruise altitude against airway MEAs, MAAs, MCAs and MRAs for the navigation equipment aboard.
