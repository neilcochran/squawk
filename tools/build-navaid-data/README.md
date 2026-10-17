# build-navaid-data

Internal build script that processes FAA NASR navaid data into the
`@squawk/navaid-data` dataset. Not published to npm.

## Input

An extracted FAA NASR 28-day subscription directory containing a CSV data ZIP
with NAV_BASE.csv, NAV_RMK.csv, and NAV_CKPT.csv.

## Process

1. Opens the CSV data ZIP from the subscription directory
2. Parses NAV_BASE.csv into navaid records
3. Filters out shutdown navaids
4. Builds typed Navaid objects from CSV fields
5. Attaches the remarks from NAV_RMK.csv, leaving out notes on how a position
   or elevation was surveyed
6. Attaches the VOR receiver checkpoints from NAV_CKPT.csv
7. Serializes records as JSON, gzip compresses, and writes the output

## Output

Gzipped JSON file written to `packages/libs/navaid-data/data/navaids.json.gz`.

## Input files

| File         | Purpose                                                   |
| ------------ | --------------------------------------------------------- |
| NAV_BASE.csv | Navaid base records: ID, type, location, frequency, etc.  |
| NAV_RMK.csv  | Remarks per navaid, mostly unusable radials and altitudes |
| NAV_CKPT.csv | VOR receiver checkpoints per navaid                       |

## Usage

```bash
npm run build
node dist/index.js --local /path/to/28DaySubscription_Effective_YYYY-MM-DD
```
