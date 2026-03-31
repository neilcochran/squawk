# @squawk

TypeScript libraries for building aviation applications - ADS-B ingestion, airspace geometry, aircraft registry lookup, and more.

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

## Development

```bash
npm install
npm run build    # build all packages
npm run test     # run all tests
npm run lint     # lint all packages
npm run docs     # generate documentation
```

## License

[MIT](LICENSE.md)
