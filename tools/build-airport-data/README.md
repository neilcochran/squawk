# build-airport-data

Internal monorepo script that processes FAA NASR airport, runway, and frequency
data into the gzipped JSON dataset consumed by `@squawk/airport-data`. Not
published to npm.

## Usage

```bash
# Build the script first
npm run build

# Run against a locally extracted NASR subscription directory
node dist/index.js --local <path-to-nasr-subscription-dir>

# Optionally override the output path
node dist/index.js --local <path> --output <output-path>
```

The `--local` path must be the root of an extracted NASR 28-day subscription
directory named `28DaySubscription_Effective_YYYY-MM-DD`. The cycle date is
parsed from the directory name and embedded in the output metadata.

The default output path is `packages/libs/airport-data/data/airports.json.gz`.

## How it works

1. Opens the CSV data ZIP inside the NASR subscription directory
2. Parses four CSV files: `APT_BASE.csv`, `APT_RWY.csv`, `APT_RWY_END.csv`, and
   `FRQ.csv`
3. Joins runways and runway ends by site number, frequencies by facility ID
4. Filters to open facilities only (closed facilities are excluded)
5. Compacts records into short-key JSON format for size reduction
6. Gzip compresses and writes the output (~1.8 MB)

## Input files

All input files come from the NASR subscription CSV data ZIP (e.g.
`CSV_Data/22_Jan_2026_CSV.zip`):

| File              | Content                                             |
| ----------------- | --------------------------------------------------- |
| `APT_BASE.csv`    | Airport identifiers, location, services, tower type |
| `APT_RWY.csv`     | Runway dimensions, surface, condition, lighting     |
| `APT_RWY_END.csv` | Per-end headings, ILS, declared distances, lighting |
| `FRQ.csv`         | Communication frequencies and usage                 |

## Dependencies

| Package                | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `@squawk/build-shared` | Shared NASR build utilities (CLI args, input resolution) |
| `@squawk/types`        | `Airport` and related type definitions                   |
| `adm-zip`              | ZIP extraction                                           |
| `geo-tz`               | IANA timezone resolution from airport coordinates        |
