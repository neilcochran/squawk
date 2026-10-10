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

The default output path is `packages/libs/airspace-data/data/airspace.geojson.gz`.

### Validating output

After generating a new bundle, run the validation script to check for
structural issues, geographic anomalies, altitude bound errors, and the values
the build derives (Class A, Class E ceilings beneath Class A):

```bash
npm run validate
```

It reads the gzipped bundle at the default output path. Pass a path to validate
another file, gzipped or plain GeoJSON:

```bash
node validate.mjs <path-to-airspace.geojson.gz>
```

## How it works

1. Parses Class B/C/D/E airspace polygons from the NASR ESRI Shapefile
   (`Class_Airspace.shp`), simplifying geometry with Douglas-Peucker (~97%
   vertex reduction)
2. Parses Special Use Airspace (MOAs, restricted, prohibited, warning, alert,
   NSA) from AIXM 5.0 XML files in the nested `SaaSubscriberFile.zip`,
   discretizing circular arcs to polygon points
3. Parses ARTCC center boundaries from `ARB_BASE.csv` and `ARB_SEG.csv`,
   emitting one feature per `(center, stratum)` shape (LOW, HIGH, UTA, plus
   oceanic CTA/FIR for US-controlled centers)
4. Derives Class A airspace, which the FAA publishes as a rule rather than
   as geometry: one feature per domestic HIGH stratum shape (and San Juan's
   combined stratum), carrying the 18,000 ft MSL to FL600 block over the
   stratum's polygon. Honolulu and the oceanic centers have no HIGH stratum
   and get none, matching 14 CFR 71.33
5. Caps Class E ceilings beneath Class A. NASR leaves the upper limit of
   nearly every Class E area undefined, so each Class E feature with an
   undefined ceiling that overlaps a Class A polygon gets 17,999 ft MSL, the
   last foot below Class A. Class E outside Class A (Hawaii) keeps the
   undefined sentinel, published ceilings are kept, and Special Use Airspace
   is untouched
6. Enriches Class B/C/D/E features with state codes from `APT_BASE.csv`
7. Merges all features, rounds coordinates to 5 decimal places (~1.1m precision),
   and writes a single GeoJSON FeatureCollection (~6,950 features)

## Input files

All input files come from inside the NASR subscription directory:

| File                          | Path within subscription                  | Content                                       |
| ----------------------------- | ----------------------------------------- | --------------------------------------------- |
| `Class_Airspace.shp` + `.dbf` | `Additional_Data/Shape_Files/`            | Class B/C/D/E polygon geometry and attributes |
| `SaaSubscriberFile.zip`       | `Additional_Data/AIXM/SAA-AIXM_5_Schema/` | SUA AIXM 5.0 XML files (nested ZIP)           |
| `APT_BASE.csv`                | Inside `CSV_Data/<cycle>.zip`             | Airport identifier to state code mapping      |
| `ARB_BASE.csv`                | Inside `CSV_Data/<cycle>.zip`             | ARTCC center metadata (name, country, state)  |
| `ARB_SEG.csv`                 | Inside `CSV_Data/<cycle>.zip`             | ARTCC boundary points by stratum and sequence |
