<h1><img src="assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk</h1>

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white) [![npm](https://img.shields.io/badge/npm-@squawk-cb3837?logo=npm&logoColor=white)](https://www.npmjs.com/org/squawk)

TypeScript libraries for building aviation applications - airspace geometry, weather parsing, flight planning, aircraft registry lookup, and more.

**[Documentation](https://neilcochran.github.io/squawk/)**

**[Architecture & conventions](ARCHITECTURE.md)**

**[Discussions](https://github.com/neilcochran/squawk/discussions)**

**[Project board](https://github.com/users/neilcochran/projects/2)**

## Layout

The repo splits into three top-level directories:

- [`apps/`](apps/) - runnable applications built on the squawk libraries. Currently [Atlas](apps/atlas), the official chart-first viewer.
- [`packages/libs/`](packages/libs/) - the published `@squawk/*` libraries listed below.
- [`tools/`](tools/) - internal data-build pipelines that produce the bundled snapshots in the `*-data` libraries.

## Packages

| Package                                                          | Description                                                                        |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`@squawk/types`](packages/libs/types)                           | Shared type definitions used across all packages                                   |
| [`@squawk/units`](packages/libs/units)                           | Aviation-aware unit conversion and formatting utilities                            |
| [`@squawk/geo`](packages/libs/geo)                               | Geospatial utilities: great-circle distance, bearing, midpoint, point-in-polygon   |
| [`@squawk/flight-math`](packages/libs/flight-math)               | Aviation flight computer calculations (E6B wind triangle, altitude, airspeed)      |
| [`@squawk/icao-registry`](packages/libs/icao-registry)           | ICAO hex to N-number and aircraft info lookup with FAA parsing utilities           |
| [`@squawk/icao-registry-data`](packages/libs/icao-registry-data) | Pre-processed FAA ReleasableAircraft snapshot for use with `@squawk/icao-registry` |
| [`@squawk/airspace`](packages/libs/airspace)                     | Point-in-airspace queries for Class B/C/D/E and Special Use Airspace               |
| [`@squawk/airspace-data`](packages/libs/airspace-data)           | Pre-processed FAA NASR airspace GeoJSON snapshot for use with `@squawk/airspace`   |
| [`@squawk/airports`](packages/libs/airports)                     | Airport queries by identifier, location, or name/city search                       |
| [`@squawk/airport-data`](packages/libs/airport-data)             | Pre-processed FAA NASR airport snapshot with runways, frequencies, and ILS data    |
| [`@squawk/navaids`](packages/libs/navaids)                       | Navaid queries by identifier, frequency, type, location, or name search            |
| [`@squawk/navaid-data`](packages/libs/navaid-data)               | Pre-processed FAA NASR navaid snapshot for use with `@squawk/navaids`              |
| [`@squawk/fixes`](packages/libs/fixes)                           | Fix/waypoint queries by identifier, location, or identifier search                 |
| [`@squawk/fix-data`](packages/libs/fix-data)                     | Pre-processed FAA NASR fix/waypoint snapshot for use with `@squawk/fixes`          |
| [`@squawk/airways`](packages/libs/airways)                       | Airway lookup, traversal, and expansion by designation, fix, or search             |
| [`@squawk/airway-data`](packages/libs/airway-data)               | Pre-processed FAA NASR airway snapshot for use with `@squawk/airways`              |
| [`@squawk/procedures`](packages/libs/procedures)                 | Instrument procedure lookup and expansion for SIDs, STARs, and IAPs (CIFP)         |
| [`@squawk/procedure-data`](packages/libs/procedure-data)         | Pre-processed FAA CIFP procedure snapshot for use with `@squawk/procedures`        |
| [`@squawk/flightplan`](packages/libs/flightplan)                 | Flight plan route string parsing and resolution using composed resolvers           |
| [`@squawk/weather`](packages/libs/weather)                       | Parse raw aviation weather strings (METAR, SPECI, TAF, SIGMET, AIRMET, PIREP)      |
| [`@squawk/notams`](packages/libs/notams)                         | Parse raw ICAO-format and FAA domestic NOTAM strings into structured objects       |
| [`@squawk/mcp`](packages/libs/mcp)                               | Model Context Protocol server exposing the squawk libraries as tools for LLMs      |

## Development

```bash
npm install
npm run build    # build all packages
npm run test     # run all tests
npm run lint     # lint all packages
npm run docs     # generate documentation
```

## Tools

The `tools/` directory contains the build pipelines that produce the data packages from raw FAA source files. They are not published to npm but are fully usable if you want to rebuild data from a newer FAA cycle or customize the pipeline. Most tools accept a [NASR subscription](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) `.zip` or extracted directory via `--local` and write their output to the corresponding data package. The ICAO registry tool parses the [FAA ReleasableAircraft](https://registry.faa.gov/database/ReleasableAircraft.zip) database; the procedure tool parses the [FAA CIFP](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/) (ARINC 424) zip. See `npm run build:data -- --help` for the orchestrator that runs them all.

| Tool                                                         | Description                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| [`build-airspace-data`](tools/build-airspace-data)           | Processes FAA NASR shapefiles and AIXM XML into airspace GeoJSON      |
| [`build-icao-registry-data`](tools/build-icao-registry-data) | Processes FAA ReleasableAircraft into ICAO registry JSON              |
| [`build-airport-data`](tools/build-airport-data)             | Processes FAA NASR airport, runway, frequency, and ILS CSVs into JSON |
| [`build-navaid-data`](tools/build-navaid-data)               | Processes FAA NASR NAV_BASE.csv into navaid JSON                      |
| [`build-fix-data`](tools/build-fix-data)                     | Processes FAA NASR FIX CSVs into fix/waypoint JSON                    |
| [`build-airway-data`](tools/build-airway-data)               | Processes FAA NASR AWY.txt and ATS.txt into airway JSON               |
| [`build-procedure-data`](tools/build-procedure-data)         | Processes FAA CIFP into SID / STAR / IAP procedure JSON               |

## License

[MIT](LICENSE.md)
