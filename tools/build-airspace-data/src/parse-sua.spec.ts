import { describe, it, expect, assert, vi, afterEach } from 'vitest';

import { greatCircle } from '@squawk/geo';

import { parseSuaXml } from './parse-sua.js';

/**
 * Builds a SAA AIXM document in the shape the FAA publishes: one Airspace
 * member with the given geometry components, the SUA and SAA extensions, a
 * legal definition annotation and a controlling ARTCC Unit member.
 */
function buildSaaDocument(components: string, suaType = 'MOA'): string {
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
function buildComponent(params: {
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
function linearRing(offset: number): string {
  return `<LinearRing>
    <pos>${-122 + offset} 38</pos>
    <pos>${-121.9 + offset} 38</pos>
    <pos>${-121.9 + offset} 38.1</pos>
    <pos>${-122 + offset} 38.1</pos>
    <pos>${-122 + offset} 38</pos>
  </LinearRing>`;
}

/**
 * The A-682 Travis AFB base ring: a line from the arc's end back round to
 * its start, then a 5 statute mile counterclockwise arc centred on
 * -122.28 38.212778 whose endpoints repeat the line's end and start points.
 */
const LINE_AND_ARC_RING = `<Ring>
  <curveMember>
    <Curve gml:id="Curve1">
      <segments>
        <LineStringSegment>
          <pos>-122.189205 38.223922</pos>
          <pos>-121.742778 38.520833</pos>
          <pos>-121.708889 38.419722</pos>
          <pos>-122.1475 38.097222</pos>
          <pos>-122.218487 38.158945</pos>
        </LineStringSegment>
      </segments>
    </Curve>
  </curveMember>
  <curveMember>
    <Curve gml:id="Curve2">
      <segments>
        <ArcByCenterPoint numArc="1">
          <pointProperty>
            <Point gml:id="Point_1">
              <pos>-122.28 38.212778</pos>
            </Point>
          </pointProperty>
          <radius uom="MI">5.0</radius>
          <startAngle uom="deg">312.06568041874635</startAngle>
          <endAngle uom="deg">368.8710130555333</endAngle>
        </ArcByCenterPoint>
      </segments>
    </Curve>
  </curveMember>
</Ring>`;

const BASE_COMPONENT = buildComponent({
  operation: 'BASE',
  sequence: 0,
  lower: 'GND',
  lowerUom: 'FT',
  lowerRef: 'SFC',
  upper: '6000',
  upperUom: 'FT',
  upperRef: 'MSL',
  ring: LINE_AND_ARC_RING,
});

const UNION_COMPONENT = buildComponent({
  operation: 'UNION',
  sequence: 2,
  lower: 'GND',
  lowerUom: 'FT',
  lowerRef: 'SFC',
  upper: '3000',
  upperUom: 'FT',
  upperRef: 'MSL',
  ring: linearRing(0.5),
});

const SUBTR_COMPONENT = buildComponent({
  operation: 'SUBTR',
  sequence: 3,
  lower: 'GND',
  lowerUom: 'FT',
  lowerRef: 'SFC',
  upper: '2900',
  upperUom: 'FT',
  upperRef: 'MSL',
  ring: linearRing(1),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseSuaXml', () => {
  it('emits one feature per BASE and UNION component and attaches SUBTR components as exclusions', () => {
    // Document order puts the UNION first; the operation sequence puts BASE first.
    const features = parseSuaXml(
      buildSaaDocument(UNION_COMPONENT + SUBTR_COMPONENT + BASE_COMPONENT),
      'TEST 1 MOA, CA.xml',
    );
    expect(features.length).toBe(2);
    const [base, union] = features;
    assert(base && union);
    expect(base.ceiling).toEqual({ valueFt: 6000, reference: 'MSL' });
    expect(union.ceiling).toEqual({ valueFt: 3000, reference: 'MSL' });
    for (const feature of features) {
      expect(feature.type).toBe('MOA');
      expect(feature.identifier).toBe('MTEST1');
      expect(feature.name).toBe('TEST 1 MOA, CA');
      expect(feature.state).toBe('CA');
      expect(feature.controllingFacility).toBe('ZOA');
      expect(feature.scheduleDescription).toBe('0800-1700 Monday-Friday; other times by NOTAM.');
      expect(feature.floor).toEqual({ valueFt: 0, reference: 'SFC' });
      expect(feature.exclusions?.length).toBe(1);
      expect(feature.exclusions?.[0]?.ceiling).toEqual({ valueFt: 2900, reference: 'MSL' });
      expect(feature.exclusions?.[0]?.boundary.coordinates[0]?.length).toBe(5);
    }
    expect(union.boundary.coordinates[0]?.length).toBe(5);
  });

  it('leaves exclusions off a feature whose airspace has no SUBTR component', () => {
    const features = parseSuaXml(buildSaaDocument(BASE_COMPONENT), 'TEST 1 MOA, CA.xml');
    expect(features[0]?.exclusions).toBe(undefined);
  });

  it('marks a limit exclusive when the FAA annotates it EXCLUSIVE', () => {
    // FOX 1 MOA: 5,000 ft AGL to but not including FL 180.
    const component = buildComponent({
      operation: 'BASE',
      sequence: 0,
      lower: '5000',
      lowerUom: 'FT',
      lowerRef: 'SFC',
      upper: '180',
      upperUom: 'FL',
      upperRef: 'STD',
      upperNote: 'EXCLUSIVE',
      lowerNote: 'INCLUSIVE',
      ring: linearRing(0),
    });
    const [feature] = parseSuaXml(buildSaaDocument(component), 'FOX 1 MOA, AK.xml');
    assert(feature !== undefined);
    expect(feature.ceiling).toEqual({ valueFt: 18000, reference: 'MSL', inclusive: false });
    expect(feature.floor).toEqual({ valueFt: 5000, reference: 'AGL' });
  });

  it('converts statute-mile radii, follows the arc direction and joins the arc to the line', () => {
    const features = parseSuaXml(buildSaaDocument(BASE_COMPONENT), 'TEST 1 MOA, CA.xml');
    const ring = features[0]?.boundary.coordinates[0];
    assert(ring !== undefined);
    // 5 line points, then the arc's 65 points minus the two that repeat the
    // line's end and start, then the closing position.
    expect(ring.length).toBe(69);
    expect(ring[0]).toEqual(ring[68]);
    const arcPoints = ring.slice(5, 68);
    for (const [lon, lat] of arcPoints) {
      assert(lon !== undefined && lat !== undefined);
      // 5 statute miles is 4.345 nautical miles.
      expect(greatCircle.distanceNm(38.212778, -122.28, lat, lon)).toBeCloseTo(4.345, 2);
    }
    // GML angle 312.07 is a bearing of 137.93 and 368.87 a bearing of 081.13:
    // travelling counterclockwise, the bearing from the center decreases, so
    // the arc runs from the line's end back to its start.
    const first = arcPoints[0];
    const last = arcPoints[arcPoints.length - 1];
    assert(first && last);
    const bearingOf = (p: number[]) => greatCircle.bearing(38.212778, -122.28, p[1]!, p[0]!);
    expect(bearingOf(first)).toBeCloseTo(137.05, 1);
    expect(bearingOf(last)).toBeCloseTo(82.02, 1);
    expect(bearingOf(first)).toBeGreaterThan(bearingOf(last));
  });

  it('keeps a short published connecting segment that is not a repeated corner', () => {
    // A line whose end lies 3 nm from the arc's start is a real edge, not a join.
    const ring = `<Ring>
      <curveMember><Curve gml:id="C1"><segments><LineStringSegment>
        <pos>-122.189205 38.223922</pos>
        <pos>-121.742778 38.520833</pos>
        <pos>-121.708889 38.419722</pos>
        <pos>-122.1475 38.097222</pos>
        <pos>-122.3 38.1</pos>
      </LineStringSegment></segments></Curve></curveMember>
      <curveMember><Curve gml:id="C2"><segments><ArcByCenterPoint numArc="1">
        <pointProperty><Point gml:id="P1"><pos>-122.28 38.212778</pos></Point></pointProperty>
        <radius uom="MI">5.0</radius>
        <startAngle uom="deg">312.06568041874635</startAngle>
        <endAngle uom="deg">368.8710130555333</endAngle>
      </ArcByCenterPoint></segments></Curve></curveMember>
    </Ring>`;
    const component = buildComponent({
      operation: 'BASE',
      sequence: 0,
      lower: 'GND',
      lowerUom: 'FT',
      lowerRef: 'SFC',
      upper: '6000',
      upperUom: 'FT',
      upperRef: 'MSL',
      ring,
    });
    const features = parseSuaXml(buildSaaDocument(component), 'TEST 1 MOA, CA.xml');
    const coordinates = features[0]?.boundary.coordinates[0];
    assert(coordinates !== undefined);
    // 5 line points plus 65 arc points minus the arc's last point (a repeat of
    // the line's first), plus the closing position.
    expect(coordinates.length).toBe(70);
    expect(coordinates[4]).toEqual([-122.3, 38.1]);
  });

  it('skips a SUA type it does not know and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const features = parseSuaXml(buildSaaDocument(BASE_COMPONENT, 'XYZ'), 'odd.xml');
    expect(features).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown SUA type "XYZ"'));
  });

  it('skips a component whose altitude block cannot be read and keeps the others', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = buildComponent({
      operation: 'UNION',
      sequence: 5,
      lower: 'GND',
      lowerUom: 'FT',
      lowerRef: 'SFC',
      upper: 'HIGH',
      upperUom: 'OTHER',
      upperRef: 'OTHER',
      ring: linearRing(2),
    });
    const features = parseSuaXml(buildSaaDocument(BASE_COMPONENT + broken), 'TEST 1 MOA, CA.xml');
    expect(features.length).toBe(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not parse altitude bounds'));
  });
});
