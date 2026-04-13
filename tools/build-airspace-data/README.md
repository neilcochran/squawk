# build-airspace-data

Internal monorepo script that processes raw FAA NASR subscription data into the
GeoJSON dataset consumed by `@squawk/airspace-data`. Not published to npm.

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

The default output path is `packages/airspace-data/data/airspace.geojson`.

### Validating output

After generating a new GeoJSON file, run the validation script to check for
structural issues, geographic anomalies, and altitude bound errors:

```bash
npm run validate
```

## How it works

1. Parses Class B/C/D/E airspace polygons from the NASR ESRI Shapefile
   (`Class_Airspace.shp`), simplifying geometry with Douglas-Peucker (~97%
   vertex reduction)
2. Parses Special Use Airspace (MOAs, restricted, prohibited, warning, alert,
   NSA) from AIXM 5.0 XML files in the nested `SaaSubscriberFile.zip`,
   discretizing circular arcs to polygon points
3. Enriches both sources with state codes from `APT_BASE.csv`
4. Merges all features, rounds coordinates to 5 decimal places (~1.1m precision),
   and writes a single GeoJSON FeatureCollection (~5 MB, ~6,800 features)

## Input files

All input files come from inside the NASR subscription directory:

| File                          | Path within subscription                  | Content                                       |
| ----------------------------- | ----------------------------------------- | --------------------------------------------- |
| `Class_Airspace.shp` + `.dbf` | `Additional_Data/Shape_Files/`            | Class B/C/D/E polygon geometry and attributes |
| `SaaSubscriberFile.zip`       | `Additional_Data/AIXM/SAA-AIXM_5_Schema/` | SUA AIXM 5.0 XML files (nested ZIP)           |
| `APT_BASE.csv`                | Inside `CSV_Data/<cycle>.zip`             | Airport identifier to state code mapping      |

## Dependencies

| Package           | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `shapefile`       | Parse ESRI Shapefile format                            |
| `fast-xml-parser` | Parse SAA AIXM 5.0 XML                                 |
| `adm-zip`         | Read nested ZIP archives in memory                     |
| `@squawk/types`   | `AirspaceFeature` and `AltitudeBound` type definitions |
