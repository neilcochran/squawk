import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * One record of a synthetic Class_Airspace shapefile: its polygon parts and
 * its attribute values.
 */
export interface ShapefileTestRecord {
  /**
   * The record's rings as [lon, lat] positions, each closed (first position
   * repeated last). The shapefile format reads a clockwise ring as an outer
   * ring, so give each part clockwise; several clockwise rings make a
   * MultiPolygon.
   */
  rings: [number, number][][];
  /** Attribute values keyed by dbf field name; a missing field is written blank. */
  attributes: Record<string, string>;
}

/** The dbf fields of the FAA Class_Airspace shapefile that the parser reads. */
const CLASS_AIRSPACE_FIELDS = [
  'IDENT',
  'NAME',
  'LOCAL_TYPE',
  'UPPER_VAL',
  'UPPER_UOM',
  'UPPER_CODE',
  'LOWER_VAL',
  'LOWER_UOM',
  'LOWER_CODE',
  'COMM_NAME',
  'WKHR_RMK',
] as const;

/** Width of every character field in the synthetic dbf. */
const FIELD_LENGTH = 40;

/** ESRI shape type code for a polygon. */
const POLYGON_SHAPE_TYPE = 5;

/**
 * Bounding box of a set of rings as [xmin, ymin, xmax, ymax].
 *
 * @param rings - The rings to measure.
 * @returns The bounding box.
 */
function boundingBox(rings: [number, number][][]): [number, number, number, number] {
  const points = rings.flat();
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * Encodes one polygon record's content: shape type, bounding box, part and
 * point counts, part start indices and the points.
 *
 * @param rings - The record's rings.
 * @returns The record content bytes.
 */
function polygonContent(rings: [number, number][][]): Buffer {
  const points = rings.flat();
  const content = Buffer.alloc(44 + 4 * rings.length + 16 * points.length);
  content.writeInt32LE(POLYGON_SHAPE_TYPE, 0);
  boundingBox(rings).forEach((value, i) => content.writeDoubleLE(value, 4 + 8 * i));
  content.writeInt32LE(rings.length, 36);
  content.writeInt32LE(points.length, 40);
  let offset = 44;
  let start = 0;
  for (const ring of rings) {
    content.writeInt32LE(start, offset);
    offset += 4;
    start += ring.length;
  }
  for (const [x, y] of points) {
    content.writeDoubleLE(x, offset);
    content.writeDoubleLE(y, offset + 8);
    offset += 16;
  }
  return content;
}

/**
 * Encodes the .shp file: the 100-byte header followed by one polygon
 * record per test record.
 *
 * @param records - The test records.
 * @returns The .shp file bytes.
 */
function shpFile(records: readonly ShapefileTestRecord[]): Buffer {
  const bodies = records.map((record, i) => {
    const content = polygonContent(record.rings);
    const header = Buffer.alloc(8);
    header.writeInt32BE(i + 1, 0);
    header.writeInt32BE(content.length / 2, 4);
    return Buffer.concat([header, content]);
  });
  const body = Buffer.concat(bodies);
  const header = Buffer.alloc(100);
  header.writeInt32BE(9994, 0);
  header.writeInt32BE((100 + body.length) / 2, 24);
  header.writeInt32LE(1000, 28);
  header.writeInt32LE(POLYGON_SHAPE_TYPE, 32);
  boundingBox(records.flatMap((record) => record.rings)).forEach((value, i) =>
    header.writeDoubleLE(value, 36 + 8 * i),
  );
  return Buffer.concat([header, body]);
}

/**
 * Encodes the .dbf file (dBASE III) holding the Class_Airspace attribute
 * fields as fixed-width character columns.
 *
 * @param records - The test records.
 * @returns The .dbf file bytes.
 */
function dbfFile(records: readonly ShapefileTestRecord[]): Buffer {
  const headerLength = 32 + 32 * CLASS_AIRSPACE_FIELDS.length + 1;
  const recordLength = 1 + FIELD_LENGTH * CLASS_AIRSPACE_FIELDS.length;
  const header = Buffer.alloc(headerLength);
  header.writeUInt8(0x03, 0);
  header.writeUInt8(126, 1);
  header.writeUInt8(10, 2);
  header.writeUInt8(29, 3);
  header.writeUInt32LE(records.length, 4);
  header.writeUInt16LE(headerLength, 8);
  header.writeUInt16LE(recordLength, 10);
  CLASS_AIRSPACE_FIELDS.forEach((name, i) => {
    const offset = 32 + 32 * i;
    header.write(name, offset, 'latin1');
    header.write('C', offset + 11, 'latin1');
    header.writeUInt8(FIELD_LENGTH, offset + 16);
  });
  header.writeUInt8(0x0d, headerLength - 1);

  const rows = records.map((record) => {
    const row = Buffer.alloc(recordLength, ' ');
    CLASS_AIRSPACE_FIELDS.forEach((name, i) => {
      const value = (record.attributes[name] ?? '').slice(0, FIELD_LENGTH);
      row.write(value, 1 + FIELD_LENGTH * i, 'latin1');
    });
    return row;
  });
  return Buffer.concat([header, ...rows, Buffer.from([0x1a])]);
}

/**
 * Writes a minimal Class_Airspace shapefile (.shp and .dbf) into a
 * directory, for tests that read it with the same shapefile reader the
 * build uses.
 *
 * @param dir - Directory to write into.
 * @param records - The polygon records to write.
 * @returns The path of the .shp file.
 */
export function writeClassAirspaceShapefile(
  dir: string,
  records: readonly ShapefileTestRecord[],
): string {
  const shpPath = join(dir, 'Class_Airspace.shp');
  writeFileSync(shpPath, shpFile(records));
  writeFileSync(join(dir, 'Class_Airspace.dbf'), dbfFile(records));
  return shpPath;
}

/**
 * A closed clockwise square ring one degree on a side, as [lon, lat]
 * positions, with its south-west corner at the given position.
 *
 * @param lon - Longitude of the south-west corner.
 * @param lat - Latitude of the south-west corner.
 * @returns The ring.
 */
export function clockwiseSquare(lon: number, lat: number): [number, number][] {
  return [
    [lon, lat],
    [lon, lat + 1],
    [lon + 1, lat + 1],
    [lon + 1, lat],
    [lon, lat],
  ];
}

/**
 * Builds a SAA AIXM document in the shape the FAA publishes: one Airspace
 * member with the given geometry components, the SUA and SAA extensions, a
 * legal definition annotation and a controlling ARTCC Unit member.
 */
export function buildSaaDocument(components: string, suaType = 'MOA'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<SaaMessage xmlns="urn:us:gov:dot:faa:aim:saa" xmlns:gml="http://www.opengis.net/gml/3.2">
  <hasMember>
    <Airspace xmlns="http://www.aixm.aero/schema/5.0" gml:id="Airspace1">
      <timeSlice>
        <AirspaceTimeSlice gml:id="Airspace1_TS1">
          <designator>MTEST1</designator>
          <name>TEST 1 MOA, CA</name>
          ${components}
          <annotation>
            <Note>
              <propertyName>legalDefinitionType</propertyName>
              <translatedNote>
                <LinguisticNote>
                  <note>TEST 1 MOA, CA. Boundaries. Beginning at a point. Altitudes. 5,000 feet MSL to but not including FL 180. Times of use. 0800-1700 Monday-Friday; other times by NOTAM. Controlling agency. FAA, Oakland ARTCC. Using agency. U.S. Air Force.</note>
                </LinguisticNote>
              </translatedNote>
            </Note>
          </annotation>
          <extension>
            <AirspaceExtension xmlns="urn:us:gov:dot:faa:aim:saa">
              <saaType>SUA</saaType>
              <administrativeArea>CALIFORNIA</administrativeArea>
            </AirspaceExtension>
          </extension>
          <extension>
            <AirspaceExtension xmlns="urn:us:gov:dot:faa:aim:saa:sua">
              <suaType>${suaType}</suaType>
            </AirspaceExtension>
          </extension>
        </AirspaceTimeSlice>
      </timeSlice>
    </Airspace>
  </hasMember>
  <hasMember>
    <Unit xmlns="http://www.aixm.aero/schema/5.0" gml:id="Unit1">
      <timeSlice>
        <UnitTimeSlice gml:id="Unit1_TS1">
          <name>OAKLAND ARTCC</name>
          <type>ARTCC</type>
          <designator>ZOA</designator>
        </UnitTimeSlice>
      </timeSlice>
    </Unit>
  </hasMember>
</SaaMessage>`;
}

/**
 * Builds one AirspaceGeometryComponent with a given operation, sequence,
 * altitude block and ring content (curve members or a LinearRing).
 */
export function buildComponent(params: {
  operation: string;
  sequence: number;
  lower: string;
  lowerUom: string;
  lowerRef: string;
  upper: string;
  upperUom: string;
  upperRef: string;
  ring: string;
  /** INCLUSIVE or EXCLUSIVE note on the upper limit, as the FAA publishes it. */
  upperNote?: string;
  /** INCLUSIVE or EXCLUSIVE note on the lower limit. */
  lowerNote?: string;
}): string {
  const note = (property: string, text: string | undefined): string =>
    text === undefined
      ? ''
      : `<annotation><Note><propertyName>${property}</propertyName><translatedNote><LinguisticNote><note>${text}</note></LinguisticNote></translatedNote></Note></annotation>`;
  return `<geometryComponent>
    <AirspaceGeometryComponent>
      <operation>${params.operation}</operation>
      <operationSequence>${params.sequence}</operationSequence>
      <theAirspaceVolume>
        <AirspaceVolume>
          <upperLimit uom="${params.upperUom}">${params.upper}</upperLimit>
          <upperLimitReference>${params.upperRef}</upperLimitReference>
          <lowerLimit uom="${params.lowerUom}">${params.lower}</lowerLimit>
          <lowerLimitReference>${params.lowerRef}</lowerLimitReference>
          <horizontalProjection>
            <Surface gml:id="Surface${params.sequence}" srsDimension="2" srsName="URN:OGC:DEF:CRS:OGC:1.3:CRS84">
              <patches xmlns="http://www.opengis.net/gml/3.2">
                <PolygonPatch>
                  <exterior>${params.ring}</exterior>
                </PolygonPatch>
              </patches>
            </Surface>
          </horizontalProjection>
          ${note('upperLimit', params.upperNote)}
          ${note('lowerLimit', params.lowerNote)}
        </AirspaceVolume>
      </theAirspaceVolume>
    </AirspaceGeometryComponent>
  </geometryComponent>`;
}

/** A square LinearRing offset east by `offset` degrees. */
export function linearRing(offset: number): string {
  return `<LinearRing>
    <pos>${-122 + offset} 38</pos>
    <pos>${-121.9 + offset} 38</pos>
    <pos>${-121.9 + offset} 38.1</pos>
    <pos>${-122 + offset} 38.1</pos>
    <pos>${-122 + offset} 38</pos>
  </LinearRing>`;
}
