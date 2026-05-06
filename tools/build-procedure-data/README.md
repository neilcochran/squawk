# build-procedure-data

Internal build script that processes the FAA CIFP (Coded Instrument Flight
Procedures) zip into a compressed JSON dataset for `@squawk/procedure-data`.
Covers Standard Instrument Departures (SIDs), Standard Terminal Arrival Routes
(STARs), and Instrument Approach Procedures (IAPs) in one unified ARINC 424
leg model.

## Usage

```bash
npm run build
node dist/index.js --cifp-fetch                           # download + build from the latest FAA release
node dist/index.js --cifp-local <path-to-zip-or-file>     # build from a local zip or extracted FAACIFP18 file
```

### Options

| Option                | Description                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `--cifp-fetch`        | Download and build from the latest FAA CIFP release (scraped from the FAA download page) |
| `--cifp-local <path>` | Path to either a CIFP zip file or the extracted `FAACIFP18` ARINC 424 data file          |
| `--output <path>`     | Output path for the .json.gz file (defaults to `packages/libs/procedure-data/data`)      |

### Example

```bash
node dist/index.js --cifp-local reference-data/CIFP_260416.zip
```

## Data source

Parses `FAACIFP18` from the FAA CIFP 28-day cycle zip (for example
`CIFP_260416.zip`). `FAACIFP18` is a 132-byte fixed-width ARINC 424 v18 file
containing roughly 400k records covering enroute waypoints, navaids, airports,
runways, and every published SID / STAR / IAP leg record.

The build does two passes over the file:

1. **Fix index build.** Scans every enroute waypoint (`EA`), airport terminal waypoint (`PC`), VHF navaid (`D`), NDB navaid (`DB`), airport reference (`PA`), runway (`PG`), localizer (`PI`), and NDB-at-airport (`PN`) record, extracting `(identifier, ICAO region code, section code)` keys mapped to decimal-degree coordinates and a category.
2. **Procedure decode.** Iterates `PD` (SID), `PE` (STAR), and `PF` (IAP) primary records, decoding each leg from its ARINC 424 fields (path terminator, altitude / speed constraints, course, distance, recommended navaid, RNP, turn direction, fly-over / FAF / MAP flags), resolving leg coordinates from the fix index, and grouping legs into `(airport, procedure identifier, type)` buckets that are split further into common routes, named transitions, and (for IAPs) the missed-approach sequence.

## Output

Writes a gzipped JSON file containing every decoded procedure to
`packages/libs/procedure-data/data/procedures.json.gz`. The output is consumed
by `@squawk/procedure-data`.

## Notes on ODPs

CIFP encodes graphic Obstacle Departure Procedures (ODPs) as SIDs (`PD`
records) with no distinguishing field. They appear in the output labelled as
`SID`. Textual ODPs are not carried by CIFP at all. See
`packages/libs/procedure-data/README.md` for the full caveat.
