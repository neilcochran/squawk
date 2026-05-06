# build-icao-registry-data

Internal monorepo script that processes the FAA ReleasableAircraft database into
the gzipped JSON dataset consumed by `@squawk/icao-registry-data`. Not published
to npm.

## Usage

```bash
# Build the script first
npm run build

# Download the latest data from the FAA and build
node dist/index.js --fetch

# Or use a locally downloaded ReleasableAircraft.zip
node dist/index.js --local <path-to-zip>

# Optionally override the output path
node dist/index.js --fetch --output <output-path>
```

The default output path is `packages/libs/icao-registry-data/data/icao-registry.json.gz`.

## How it works

1. Downloads (or reads) the FAA `ReleasableAircraft.zip`
2. Delegates parsing to `parseFaaRegistryZip()` from `@squawk/icao-registry`,
   which extracts `MASTER.txt` and `ACFTREF.txt`, parses both CSVs, and joins
   them by manufacturer/model code
3. Serializes records as JSON, gzip compresses, and writes the output

## Dependencies

| Package                 | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `@squawk/build-shared`  | Shared NASR build utilities (CLI args, input resolution) |
| `@squawk/icao-registry` | `parseFaaRegistryZip()` parsing logic                    |
