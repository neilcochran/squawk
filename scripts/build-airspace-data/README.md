# build-airspace-data

Internal monorepo script that processes raw FAA NASR subscription data into the
GeoJSON dataset consumed by `@squawk/airspace-data`. This script is not published
to npm and has no public API.

---

## Purpose

The FAA releases updated National Airspace System Resource (NASR) subscription data
on a 28-day cycle. This script reads two source formats from that subscription -
an ESRI Shapefile for Class B/C/D airspace and AIXM 5.0 XML files for Special Use
Airspace (SUA) - normalizes them into a common `AirspaceFeature` shape, and writes
a single GeoJSON `FeatureCollection` file. That file is committed into
`packages/airspace-data/data/` and bundled with the `@squawk/airspace-data` package.

---

## Usage

```bash
# Build the script first (compiles TypeScript to dist/)
npm run build

# Run against a locally extracted NASR subscription directory
node dist/index.js --local <path-to-nasr-subscription-dir>

# Optionally override the output path (defaults to packages/airspace-data/data/airspace.geojson)
node dist/index.js --local <path> --output <output-path>
```

The `--local` path must be the root of an extracted NASR 28-day subscription
directory named in the format `28DaySubscription_Effective_YYYY-MM-DD`. The cycle
date is parsed directly from that directory name and embedded in the output file's
metadata.

### Validating output

After generating a new GeoJSON file, run the validation script to check for
structural issues, geographic anomalies, altitude bound errors, and known-value
spot checks:

```bash
npm run validate
```

The script exits with code 0 if all checks pass (warnings are allowed) and code 1
if any check fails. It can also accept a path to a specific file:

```bash
node validate.mjs /path/to/airspace.geojson
```

### Visual inspection

To visually spot-check the output on an interactive map:

```bash
npm run viewer
```

This starts a local HTTP server and opens a Leaflet map in the browser with all
features color-coded by airspace type. Features can be filtered by type checkbox,
searched by name or identifier, and clicked to inspect all properties. Use this
after every data update to verify that geometry looks correct -- especially arcs,
circles, and simplified shapefile polygons.

---

## Input files

All input files come from inside the NASR subscription directory. The script
resolves them by fixed relative paths:

| File                          | Path within subscription                  | Purpose                                     |
| ----------------------------- | ----------------------------------------- | ------------------------------------------- |
| `Class_Airspace.shp` + `.dbf` | `Additional_Data/Shape_Files/`            | Class B/C/D polygon geometry and attributes |
| `SaaSubscriberFile.zip`       | `Additional_Data/AIXM/SAA-AIXM_5_Schema/` | SUA AIXM 5.0 XML files (nested ZIP)         |
| `APT_BASE.csv`                | Inside `CSV_Data/<cycle>.zip`             | Airport identifier to state code mapping    |

`APT_BASE.csv` is packaged inside a date-named ZIP (e.g. `22_Jan_2026_CSV.zip`).
The script finds whichever `.zip` is present in `CSV_Data/`, extracts `APT_BASE.csv`
to a temp file, and cleans it up after parsing.

---

## Pipeline overview

```
NASR subscription directory
        |
        +-- Class_Airspace.shp/.dbf
        |         |
        |   parse-class-airspace.ts  <-- APT_BASE.csv (state enrichment)
        |         |                  <-- simplify-polygon.ts (Douglas-Peucker)
        |         |
        |   AirspaceFeature[] (Class B/C/D)
        |
        +-- SaaSubscriberFile.zip
                  |
            parse-sua.ts  <-- discretize-arc.ts (arc/circle to points)
                  |
            AirspaceFeature[] (SUA)
                  |
            (merge both arrays)
                  |
            write-output.ts  (coordinate precision rounding)
                  |
        packages/airspace-data/data/airspace.geojson
```

---

## Source modules

### `index.ts`

CLI entry point. Parses `--local` and `--output` arguments, resolves all input
file paths, and orchestrates the pipeline in order:

1. Extract `APT_BASE.csv` from the CSV ZIP to a temp file
2. `loadAirportStates` - build airport identifier to state code map
3. `parseClassAirspace` - parse Class B/C/D features from shapefile
4. `parseSua` - parse SUA features from AIXM XML
5. `writeOutput` - merge and write to GeoJSON
6. Delete the temp CSV file (always, even on error)

### `load-airport-states.ts`

Reads `APT_BASE.csv` line by line using `node:readline`. The FAA CSV wraps every
field in double quotes, so each line is parsed by stripping the outer quotes and
splitting on `","`. The `ARPT_ID` and `STATE_CODE` column positions are discovered
dynamically from the header row. Returns a `Map<string, string>` from airport
identifier (e.g. `"DTW"`) to two-letter state code (e.g. `"MI"`).

### `parse-class-airspace.ts`

Reads `Class_Airspace.shp` using the `shapefile` npm package (CJS-only, loaded via
`createRequire` from the ESM module). Filters to records where `LOCAL_TYPE` is
`CLASS_B`, `CLASS_C`, or `CLASS_D`. Maps each shapefile record to an
`AirspaceFeature`:

- `state` is populated by looking up the record's `IDENT` field (the associated
  airport identifier) in the `airportStates` map. The shapefile has no state field.
  Class B outer rings may extend into adjacent states; the airport's state is the
  correct FAA-attributed value for this field.
- Class B airspace is structured as stacked concentric rings, each stored as a
  separate polygon record in the shapefile. Each ring becomes its own
  `AirspaceFeature` with its own floor and ceiling.
- `MultiPolygon` geometries are reduced to the largest polygon by exterior ring
  coordinate count, which covers all known Class B/C/D records correctly.
- Every polygon is simplified with Douglas-Peucker (see `simplify-polygon.ts`)
  before being stored. The raw shapefile encodes airspace boundaries with extremely
  dense vertex counts (often 3,000+ per feature, up to 14,000). After
  simplification at a tolerance of 0.0001 degrees (~11m), polygons average ~60
  vertices - a 97%+ reduction with no meaningful loss in boundary accuracy.

### `simplify-polygon.ts`

Implements the Douglas-Peucker line simplification algorithm for GeoJSON Polygons.
Given a tolerance in degrees, it removes vertices that deviate from the straight
line between their neighbors by less than that tolerance. Applied to shapefile
polygons in `parse-class-airspace.ts`.

- Processes each ring of the polygon independently
- Preserves the first and last coordinate of each ring (ring closure)
- If simplification would reduce a ring below 4 coordinates (the GeoJSON minimum
  for a valid polygon ring), the ring is left unchanged
- The tolerance of 0.0001 degrees (~11m) is well within the ~30m precision of the
  FAA's legal airspace boundary definitions (specified to the nearest arcsecond)

### `parse-sua.ts`

Reads SUA boundaries and metadata from the SAA AIXM 5.0 subscriber file. The outer
`SaaSubscriberFile.zip` contains a nested `Saa_Sub_File.zip`, which in turn holds
one XML file per SUA (e.g. `ADIRONDACK B MOA, NY.xml`). The script uses `adm-zip`
to read both ZIPs in memory with no temp files on disk.

Each XML file is parsed with `fast-xml-parser`. The parser is configured with
`isArray` for elements that can repeat: `hasMember`, `curveMember`,
`geometryComponent`, `annotation`, `extension`, `pos`, and `sheet`.

**SUA type mapping:**

| `suaType` in XML | `AirspaceType`                                     |
| ---------------- | -------------------------------------------------- |
| `MOA`            | `MOA`                                              |
| `RA`             | `RESTRICTED`                                       |
| `WA`             | `WARNING`                                          |
| `AA`             | `ALERT`                                            |
| `PA`             | `PROHIBITED`                                       |
| `NSA`            | Skipped (National Security Areas are out of scope) |

**Multiple geometry components:** Some records define their airspace using multiple
`geometryComponent` elements with an `operation` field (`BASE`, `SUBTR`, etc.). The
script always uses the component with `operation === 'BASE'`, which carries the
primary boundary. Subtraction components (exclusion zones) are not applied.

**Geometry types:** SUA boundaries use GML and can contain three curve segment types:

- `LineStringSegment` - a sequence of `<pos>` lon/lat pairs, converted directly.
- `LinearRing` - a simpler polygon format with `<pos>` elements as direct children
  of the ring (no intermediate `curveMember`). Parsed the same way as
  `LineStringSegment`.
- `ArcByCenterPoint` - a circular arc defined by center point, radius (NM), start
  angle, and end angle (degrees from east, counterclockwise). Discretized to 64
  points via `discretize-arc.ts`.
- `CircleByCenterPoint` - a full circle defined by center point and radius only (no
  angles). Treated as a 360-degree arc and discretized to 64 points.

GML `srsName="URN:OGC:DEF:CRS:OGC:1.3:CRS84"` uses lon/lat coordinate order,
which matches GeoJSON.

**State extraction:** The SAA XML stores the state as a full name (e.g. `"VIRGINIA"`)
in the `administrativeArea` field of the SUA-namespace `AirspaceExtension`. The
`STATE_NAME_TO_CODE` map in `parse-sua.ts` converts these to two-letter codes.

**Controlling facility:** Extracted from the `Unit` member with `type === 'ARTCC'`.
Returns the ARTCC designator string (e.g. `"ZDC"`).

**Schedule description:** Extracted from the `legalDefinitionType` annotation using
a regex that captures the "Times of use." section of the legal text up to the next
labeled section.

### `normalize-altitude.ts`

Normalizes altitude fields from both source formats into `AltitudeBound`:

```typescript
interface AltitudeBound {
  valueFt: number; // altitude in feet
  reference: 'MSL' | 'AGL' | 'SFC';
}
```

**`normalizeShapefileAltitude(val, uom, code)`** handles the Class B/C/D shapefile
VAL/UOM/CODE field triplets:

| `CODE` | `UOM` | `VAL`   | Result                                                      |
| ------ | ----- | ------- | ----------------------------------------------------------- |
| `SFC`  | any   | any     | `{ valueFt: 0, reference: 'SFC' }`                          |
| any    | any   | `-9998` | `{ valueFt: 99999, reference: 'MSL' }` (unlimited sentinel) |
| `MSL`  | `FT`  | number  | `{ valueFt: val, reference: 'MSL' }`                        |
| `AGL`  | `FT`  | number  | `{ valueFt: val, reference: 'AGL' }`                        |
| any    | `FL`  | number  | `{ valueFt: val * 100, reference: 'MSL' }`                  |

**`normalizeSaaAltitude(value, uom, reference)`** handles SAA AIXM XML altitude
elements:

| `uom`              | `reference` | `value` | Result                                             |
| ------------------ | ----------- | ------- | -------------------------------------------------- |
| `FT`               | `SFC`       | any     | `{ valueFt: 0, reference: 'SFC' }`                 |
| `FT`               | `MSL`       | number  | `{ valueFt: value, reference: 'MSL' }`             |
| `FT`               | `AGL`       | number  | `{ valueFt: value, reference: 'AGL' }`             |
| `FL`               | `STD`       | number  | `{ valueFt: value * 100, reference: 'MSL' }`       |
| `OTHER`            | any         | `"UNL"` | `{ valueFt: 99999, reference: 'MSL' }` (unlimited) |
| any                | `OTHER`     | `"GND"` | `{ valueFt: 0, reference: 'SFC' }` (ground level)  |
| `OTHER` or `OTHER` | other       | other   | `null` (AirspaceUsage schedule placeholder, skip)  |

`AGL` altitudes are preserved as-is. The `@squawk/airspace` resolver handles them
conservatively by including the airspace when it cannot determine the MSL
equivalent, rather than silently excluding it.

### `discretize-arc.ts`

Converts a GML `ArcByCenterPoint` into an array of `[lon, lat]` coordinate pairs
using a flat-earth approximation. This approximation is accurate to well within
0.1 NM for any US airspace feature.

- Radius is converted from NM to degrees latitude: `radiusDeg = radiusNm / 60`
- Longitude degrees per NM are scaled by `cos(lat)` to account for meridian
  convergence
- Angles follow GML convention: degrees from east (positive X axis),
  counterclockwise
- If `endAngle <= startAngle`, 360 degrees is added to `endAngle` so the arc always
  sweeps counterclockwise
- Default point count is 64, which produces smooth curves at any airspace scale

### `write-output.ts`

Serializes the merged `AirspaceFeature[]` to a GeoJSON `FeatureCollection`. Each
feature maps as follows:

- `boundary` (a GeoJSON `Polygon`) becomes the GeoJSON `geometry`
- All other fields (`type`, `name`, `identifier`, `floor`, `ceiling`, `state`,
  `controllingFacility`, `scheduleDescription`) become the GeoJSON `properties`
- All coordinate values are rounded to 5 decimal places (~1.1m precision) before
  serialization. This eliminates floating-point noise from trig computations in
  arc discretization and trims excess precision from shapefile coordinates.

The top-level `FeatureCollection` object also carries a `properties` object with
dataset metadata:

```json
{
  "type": "FeatureCollection",
  "properties": {
    "nasrCycleDate": "2026-01-22",
    "generatedAt": "2026-01-30T12:00:00.000Z",
    "featureCount": 2505
  },
  "features": [ ... ]
}
```

The output directory is created recursively if it does not already exist.

---

## Output

The default output path is `packages/airspace-data/data/airspace.geojson`, relative
to the monorepo root. This file is consumed directly by the `@squawk/airspace-data`
package. It is excluded from Prettier formatting (see `.prettierignore`).

In a typical run against the 2026-01-22 NASR cycle the output contains approximately
2,505 features (~1,286 Class B/C/D polygon rings and ~1,219 SUA features) with
~150,000 total coordinate pairs. The output file is approximately 3.8 MB.

Without polygon simplification and coordinate rounding, the same dataset produces a
~162 MB file (4.1M coordinate pairs), driven by the shapefile's extremely dense
polygon vertices (averaging 3,175 per feature). The Douglas-Peucker simplification
and precision rounding reduce this by ~97% with no meaningful loss in boundary
accuracy.

---

## Dependencies

| Package           | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `shapefile`       | Parse ESRI Shapefile format (CJS-only)                 |
| `fast-xml-parser` | Parse SAA AIXM 5.0 XML                                 |
| `adm-zip`         | Read nested ZIP archives in memory                     |
| `@squawk/types`   | `AirspaceFeature` and `AltitudeBound` type definitions |
