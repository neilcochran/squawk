# build-airway-data

Internal build script that processes FAA NASR airway data into the
`@squawk/airway-data` dataset. Not published to npm.

## Input

An extracted FAA NASR 28-day subscription directory containing the fixed-width
files `AWY.txt` and `ATS.txt`. Both files live at the root of the subscription
directory rather than inside the `CSV_Data` ZIP, so no archive extraction is
needed.

## Process

1. Reads `AWY.txt` line-by-line, parsing `AWY1` records (airway header per
   sequence) and `AWY2` records (waypoint detail per sequence)
2. Joins `AWY1` / `AWY2` records by `(designation, type-char, sequence)` into
   ordered waypoint sequences for Victor, Jet, RNAV Q/T, and color (Green,
   Red, Amber, Blue) airways
3. Reads `ATS.txt` line-by-line, parsing `ATS1` and `ATS2` records the same
   way for Atlantic, Bahama, Pacific, and Puerto Rico routes
4. Takes each point's distance to the next from the segment distance field
   (`AWY1` column 69, `ATS1` column 79), falling back to the header distance
   field (column 45 / 55). `distanceToNextNm` is set only where that value
   describes a leg to the next waypoint in the output: it is left unset when
   both fields are `000.00` (NASR's "no leg follows"), when the airway gap
   flag marks the airway as discontinued after the point, when the next point
   is dropped for lacking coordinates (border crossings), and on the last
   point of an airway
5. Resolves each airway's `type` (from the designation prefix) and `region`
   (from the airway-type character) via `@squawk/types` mapping constants
6. Sorts the merged result by designation and writes it as gzipped JSON

## Output

Gzipped JSON file written to `packages/libs/airway-data/data/airways.json.gz`.

## Input files

| File      | Purpose                                                   |
| --------- | --------------------------------------------------------- |
| `AWY.txt` | US-domestic airways: Victor, Jet, RNAV Q/T, color routes  |
| `ATS.txt` | Oceanic and territorial routes: Atlantic, Bahama, Pacific |

## Usage

```bash
npm run build
node dist/index.js --local /path/to/28DaySubscription_Effective_YYYY-MM-DD
```
