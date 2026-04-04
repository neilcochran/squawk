# build-procedure-data

Internal build script that processes the FAA NASR STARDP.txt fixed-width file
into a compressed JSON dataset for `@squawk/procedure-data`.

## Usage

```bash
npm run build
node dist/index.js --local <path-to-nasr-subscription-dir>
```

### Options

| Option            | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| `--local <path>`  | Path to an extracted FAA NASR 28-day subscription directory    |
| `--output <path>` | Output path for the .json.gz file (defaults to procedure-data) |

### Example

```bash
node dist/index.js --local raw-airspace-data/28DaySubscription_Effective_2026-01-22
```

## Data source

Parses `STARDP.txt` from the FAA NASR 28-day subscription. Each record is a
223-byte fixed-width line encoding one waypoint of a SID or STAR procedure.
Records are grouped by a 4-digit sequence number into complete procedures, then
split into common routes (trunk paths) and named transitions.

## Output

Writes a gzipped JSON file containing all parsed SID and STAR procedures with
compact field names for storage efficiency. The output is consumed by
`@squawk/procedure-data`.
