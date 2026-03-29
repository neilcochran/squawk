# @squawk

A collection of focused TypeScript libraries for building aviation applications — ADS-B ingestion, airspace geometry, aircraft registry lookup, and more.

**[Documentation](https://neilcochran.github.io/squawk/)**

## Packages

| Package                                             | Description                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| [`@squawk/types`](packages/types)                   | Shared TypeScript type definitions used across all packages         |
| [`@squawk/adsb-stream`](packages/adsb-stream)       | ADS-B flight data ingestion and normalization from multiple sources |
| [`@squawk/artcc-resolver`](packages/artcc-resolver) | Resolves which ARTCC Center owns a given lat/lon/altitude position  |
| [`@squawk/icao-registry`](packages/icao-registry)   | FAA ICAO hex address to aircraft registration and info lookup       |

## Development

```bash
npm install
npm run build    # build all packages
npm run test     # run all tests
npm run lint     # lint all packages
npm run docs     # generate documentation
```

## License

MIT
