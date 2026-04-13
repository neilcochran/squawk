<h1><img src="assets/squawk-logo.svg" alt="squawk logo" width="48" height="48" style="vertical-align: middle">&nbsp; @squawk</h1>

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)

TypeScript libraries for building aviation applications - airspace geometry, weather parsing, flight planning, aircraft registry lookup, and more.

**[Documentation](https://neilcochran.github.io/squawk/)**

## Packages

| Package                                                     | Description                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`@squawk/types`](packages/types)                           | Shared type definitions used across all packages                                   |
| [`@squawk/units`](packages/units)                           | Aviation-aware unit conversion and formatting utilities                            |
| [`@squawk/flight-math`](packages/flight-math)               | Aviation flight computer calculations (E6B wind triangle, altitude, airspeed)      |
| [`@squawk/icao-registry`](packages/icao-registry)           | ICAO hex to N-number and aircraft info lookup with FAA parsing utilities           |
| [`@squawk/icao-registry-data`](packages/icao-registry-data) | Pre-processed FAA ReleasableAircraft snapshot for use with `@squawk/icao-registry` |
| [`@squawk/airspace`](packages/airspace)                     | Point-in-airspace queries for Class B/C/D/E and Special Use Airspace               |
| [`@squawk/airspace-data`](packages/airspace-data)           | Pre-processed FAA NASR airspace GeoJSON snapshot for use with `@squawk/airspace`   |
| [`@squawk/airports`](packages/airports)                     | Airport queries by identifier, location, or name/city search                       |
| [`@squawk/airport-data`](packages/airport-data)             | Pre-processed FAA NASR airport snapshot with runways, frequencies, and ILS data    |
| [`@squawk/navaids`](packages/navaids)                       | Navaid queries by identifier, frequency, type, location, or name search            |
| [`@squawk/navaid-data`](packages/navaid-data)               | Pre-processed FAA NASR navaid snapshot for use with `@squawk/navaids`              |
| [`@squawk/fixes`](packages/fixes)                           | Fix/waypoint queries by identifier, location, or identifier search                 |
| [`@squawk/fix-data`](packages/fix-data)                     | Pre-processed FAA NASR fix/waypoint snapshot for use with `@squawk/fixes`          |
| [`@squawk/airways`](packages/airways)                       | Airway lookup, traversal, and expansion by designation, fix, or search             |
| [`@squawk/airway-data`](packages/airway-data)               | Pre-processed FAA NASR airway snapshot for use with `@squawk/airways`              |
| [`@squawk/procedures`](packages/procedures)                 | Instrument procedure lookup and expansion for SIDs and STARs                       |
| [`@squawk/procedure-data`](packages/procedure-data)         | Pre-processed FAA NASR procedure snapshot for use with `@squawk/procedures`        |
| [`@squawk/flightplan`](packages/flightplan)                 | Flight plan route string parsing and resolution using composed resolvers           |
| [`@squawk/weather`](packages/weather)                       | Parse raw aviation weather strings (METAR, SPECI, TAF, SIGMET, AIRMET, PIREP)      |
| [`@squawk/notams`](packages/notams)                         | Parse raw ICAO-format NOTAM strings into structured objects                        |

## Development

```bash
npm install
npm run build    # build all packages
npm run test     # run all tests
npm run lint     # lint all packages
npm run docs     # generate documentation
```

## Tools

The `tools/` directory contains the build pipelines that produce the data packages from raw FAA source files. They are not published to npm but are fully usable if you want to rebuild data from a newer FAA cycle or customize the pipeline. Each tool accepts a [NASR subscription](https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/) `.zip` or extracted directory via `--local` and writes its output to the corresponding data package. The ICAO registry tool parses the [FAA ReleasableAircraft](https://registry.faa.gov/database/ReleasableAircraft.zip) database. See `npm run build:data -- --help` for the orchestrator that runs them all.

| Tool                                                         | Description                                                           |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| [`build-airspace-data`](tools/build-airspace-data)           | Processes FAA NASR shapefiles and AIXM XML into airspace GeoJSON      |
| [`build-icao-registry-data`](tools/build-icao-registry-data) | Processes FAA ReleasableAircraft into ICAO registry JSON              |
| [`build-airport-data`](tools/build-airport-data)             | Processes FAA NASR airport, runway, frequency, and ILS CSVs into JSON |
| [`build-navaid-data`](tools/build-navaid-data)               | Processes FAA NASR NAV_BASE.csv into navaid JSON                      |
| [`build-fix-data`](tools/build-fix-data)                     | Processes FAA NASR FIX CSVs into fix/waypoint JSON                    |
| [`build-airway-data`](tools/build-airway-data)               | Processes FAA NASR AWY.txt and ATS.txt into airway JSON               |
| [`build-procedure-data`](tools/build-procedure-data)         | Processes FAA NASR STARDP.txt into procedure JSON                     |
| [`map-viewer`](tools/map-viewer)                             | Interactive Leaflet map for viewing airspace and airport data         |

## License

[MIT](LICENSE.md)
