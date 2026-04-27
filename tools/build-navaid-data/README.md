# build-navaid-data

Internal build script that processes FAA NASR navaid data into the
`@squawk/navaid-data` dataset. Not published to npm.

## Input

An extracted FAA NASR 28-day subscription directory containing a CSV data ZIP
with NAV_BASE.csv.

## Process

1. Opens the CSV data ZIP from the subscription directory
2. Parses NAV_BASE.csv into navaid records
3. Filters out shutdown navaids
4. Builds typed Navaid objects from CSV fields
5. Compacts records into short-key JSON and gzip compresses

## Output

Gzipped JSON file written to `packages/libs/navaid-data/data/navaids.json.gz`.

## Input files

| File         | Purpose                                                  |
| ------------ | -------------------------------------------------------- |
| NAV_BASE.csv | Navaid base records: ID, type, location, frequency, etc. |

## Usage

```bash
npm run build
node dist/index.js --local /path/to/28DaySubscription_Effective_YYYY-MM-DD
```

## Dependencies

- `@squawk/types` - Navaid type definitions and mapping constants
- `adm-zip` - ZIP file extraction
