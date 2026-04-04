# @squawk

TypeScript libraries for building aviation applications - ADS-B ingestion, airspace geometry, aircraft registry lookup, airport data, and more.

**[Documentation](https://neilcochran.github.io/squawk/)**

## Packages

| Package                                                     | Description                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`@squawk/types`](packages/types)                           | Shared type definitions used across all packages                                   |
| [`@squawk/units`](packages/units)                           | Aviation-aware unit conversion and formatting utilities                            |
| [`@squawk/adsb-stream`](packages/adsb-stream)               | ADS-B ingestion and normalization from dump1090/readsb or external APIs            |
| [`@squawk/icao-registry`](packages/icao-registry)           | ICAO hex to N-number and aircraft info lookup with FAA parsing utilities           |
| [`@squawk/icao-registry-data`](packages/icao-registry-data) | Pre-processed FAA ReleasableAircraft snapshot for use with `@squawk/icao-registry` |
| [`@squawk/airspace`](packages/airspace)                     | Point-in-airspace queries for Class B/C/D and Special Use Airspace                 |
| [`@squawk/airspace-data`](packages/airspace-data)           | Pre-processed FAA NASR airspace GeoJSON snapshot for use with `@squawk/airspace`   |
| [`@squawk/airports`](packages/airports)                     | Airport queries by identifier, location, or name/city search                       |
| [`@squawk/airport-data`](packages/airport-data)             | Pre-processed FAA NASR airport snapshot with runways, frequencies, and ILS data    |

## Development

```bash
npm install
npm run build    # build all packages
npm run test     # run all tests
npm run lint     # lint all packages
npm run docs     # generate documentation
```

## Scripts

The `scripts/` directory contains internal tools for building data packages and
inspecting their output. These are not published to npm.

| Script                                                         | Description                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`build-airspace-data`](scripts/build-airspace-data)           | Processes FAA NASR shapefiles and AIXM XML into airspace GeoJSON      |
| [`build-icao-registry-data`](scripts/build-icao-registry-data) | Processes FAA ReleasableAircraft into ICAO registry JSON              |
| [`build-airport-data`](scripts/build-airport-data)             | Processes FAA NASR airport, runway, frequency, and ILS CSVs into JSON |
| [`map-viewer`](scripts/map-viewer)                             | Interactive Leaflet map for viewing airspace and airport data         |

## License

[MIT](LICENSE.md)
