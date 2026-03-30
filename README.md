# @squawk

TypeScript libraries for building aviation applications - ADS-B ingestion, airspace geometry, aircraft registry lookup, and more.

**[Documentation](https://neilcochran.github.io/squawk/)**

## Packages

| Package                                             | Description                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| [`@squawk/types`](packages/types)                   | Shared type definitions used across all packages                        |
| [`@squawk/units`](packages/units)                   | Aviation-aware unit conversion and formatting utilities                 |
| [`@squawk/adsb-stream`](packages/adsb-stream)       | ADS-B ingestion and normalization from dump1090/readsb or external APIs |
| [`@squawk/artcc-resolver`](packages/artcc-resolver) | Point-in-airspace lookup returning the controlling ARTCC sector         |
| [`@squawk/icao-registry`](packages/icao-registry)   | ICAO hex to N-number and aircraft info via FAA registry                 |

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
