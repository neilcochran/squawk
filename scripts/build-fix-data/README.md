# build-fix-data

Internal build script that processes FAA NASR fix/waypoint data into the
`@squawk/fix-data` dataset. Not published to npm.

## Input

An extracted FAA NASR 28-day subscription directory containing a CSV data ZIP
with FIX_BASE.csv, FIX_CHRT.csv, and FIX_NAV.csv.

## Process

1. Opens the CSV data ZIP from the subscription directory
2. Parses FIX_BASE.csv into fix records
3. Filters out CNF (computer navigation fix) records
4. Builds typed Fix objects from CSV fields
5. Enriches fixes with chart type associations from FIX_CHRT.csv
6. Enriches fixes with navaid associations from FIX_NAV.csv
7. Compacts records into short-key JSON and gzip compresses

## Output

Gzipped JSON file written to `packages/fix-data/data/fixes.json.gz`.

## Input files

| File         | Purpose                                                       |
| ------------ | ------------------------------------------------------------- |
| FIX_BASE.csv | Fix base records: ID, location, use code, ARTCC, flags        |
| FIX_CHRT.csv | Chart type associations per fix (IAP, STAR, ENROUTE, etc.)    |
| FIX_NAV.csv  | Navaid associations: bearing and distance from nearby navaids |

## Usage

```bash
npm run build
node dist/index.js --local /path/to/28DaySubscription_Effective_YYYY-MM-DD
```

## Dependencies

- `@squawk/types` - Fix type definitions and mapping constants
- `adm-zip` - ZIP file extraction
