import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import AdmZip from 'adm-zip';
import { describe, it, expect, assert, vi, afterEach } from 'vitest';

import { greatCircle } from '@squawk/geo';

import { parseSua, parseSuaXml } from './parse-sua.js';
import { buildComponent, buildSaaDocument, linearRing } from './test-utils.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Silences console.warn for the current test and returns the spy so the test
 * can assert on the messages.
 */
function silenceWarnings(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined);
}

/** Builds a BASE component from 0 to 6,000 ft MSL with the given ring content. */
function baseWithRing(ring: string): string {
  return buildComponent({
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
}

/** Wraps curve member segments in a GML Ring. */
function ring(...segments: string[]): string {
  return `<Ring>${segments
    .map(
      (segment, i) =>
        `<curveMember><Curve gml:id="C${i}"><segments>${segment}</segments></Curve></curveMember>`,
    )
    .join('')}</Ring>`;
}

/** A LineStringSegment through the given "lon lat" positions. */
function line(...positions: string[]): string {
  return `<LineStringSegment>${positions.map((p) => `<pos>${p}</pos>`).join('')}</LineStringSegment>`;
}

/** An ArcByCenterPoint with the given center, radius element and angles. */
function arc(
  center: string | undefined,
  radius: string,
  startAngle?: number,
  endAngle?: number,
): string {
  const centerXml = center === undefined ? '' : `<pos>${center}</pos>`;
  const start = startAngle === undefined ? '' : `<startAngle uom="deg">${startAngle}</startAngle>`;
  const end = endAngle === undefined ? '' : `<endAngle uom="deg">${endAngle}</endAngle>`;
  return `<ArcByCenterPoint numArc="1"><pointProperty><Point gml:id="P1">${centerXml}</Point></pointProperty>${radius}${start}${end}</ArcByCenterPoint>`;
}

/** A CircleByCenterPoint with the given center and radius element. */
function circle(center: string | undefined, radius: string): string {
  const centerXml = center === undefined ? '' : `<pos>${center}</pos>`;
  return `<CircleByCenterPoint numArc="1"><pointProperty><Point gml:id="P2">${centerXml}</Point></pointProperty>${radius}</CircleByCenterPoint>`;
}

/** A closed square LineStringSegment, enough on its own for a valid ring. */
const SQUARE = line('-122 38', '-121.9 38', '-121.9 38.1', '-122 38.1', '-122 38');

describe('parseSuaXml with incomplete documents', () => {
  it('returns nothing when the document has no Airspace member', () => {
    const warn = silenceWarnings();
    const xml = `<SaaMessage xmlns="urn:us:gov:dot:faa:aim:saa"><hasMember><Unit><timeSlice><UnitTimeSlice><type>ARTCC</type></UnitTimeSlice></timeSlice></Unit></hasMember></SaaMessage>`;
    expect(parseSuaXml(xml, 'units-only.xml')).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No Airspace member'));
  });

  it('returns nothing when the Airspace member has no time slice', () => {
    const xml = `<SaaMessage><hasMember><Airspace><designator>X</designator></Airspace></hasMember></SaaMessage>`;
    expect(parseSuaXml(xml, 'no-slice.xml')).toEqual([]);
  });

  it('returns nothing when no extension names the SUA type', () => {
    const xml = buildSaaDocument(baseWithRing(linearRing(0))).replace(
      /<suaType>MOA<\/suaType>/,
      '',
    );
    expect(parseSuaXml(xml, 'no-type.xml')).toEqual([]);
  });

  it('returns nothing when the time slice has no extensions at all', () => {
    const xml = `<SaaMessage><hasMember><Airspace><timeSlice><AirspaceTimeSlice><designator>X</designator></AirspaceTimeSlice></timeSlice></Airspace></hasMember></SaaMessage>`;
    expect(parseSuaXml(xml, 'no-extensions.xml')).toEqual([]);
  });

  it('returns nothing and says so when the airspace has no geometry component', () => {
    const warn = silenceWarnings();
    expect(parseSuaXml(buildSaaDocument(''), 'no-geometry.xml')).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No usable geometry component'));
  });

  it('skips a component with an unknown operation', () => {
    const warn = silenceWarnings();
    const odd = buildComponent({
      operation: 'INTERS',
      sequence: 1,
      lower: 'GND',
      lowerUom: 'FT',
      lowerRef: 'SFC',
      upper: '6000',
      upperUom: 'FT',
      upperRef: 'MSL',
      ring: linearRing(0),
    });
    expect(parseSuaXml(buildSaaDocument(odd), 'odd-operation.xml')).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown geometry operation "INTERS"'),
    );
  });

  it('treats a component without an operation or sequence as the BASE volume', () => {
    const component = baseWithRing(linearRing(0))
      .replace('<operation>BASE</operation>', '')
      .replace('<operationSequence>0</operationSequence>', '');
    const features = parseSuaXml(buildSaaDocument(component), 'no-operation.xml');
    expect(features.length).toBe(1);
  });

  it('skips a component without an airspace volume', () => {
    const warn = silenceWarnings();
    const component = `<geometryComponent><AirspaceGeometryComponent><operation>BASE</operation></AirspaceGeometryComponent></geometryComponent>`;
    expect(parseSuaXml(buildSaaDocument(component), 'no-volume.xml')).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No AirspaceVolume'));
  });

  it('keeps a limit inclusive when the FAA annotates it INCLUSIVE', () => {
    const component = buildComponent({
      operation: 'BASE',
      sequence: 0,
      lower: 'GND',
      lowerUom: 'FT',
      lowerRef: 'SFC',
      upper: '180',
      upperUom: 'FL',
      upperRef: 'STD',
      ring: linearRing(0),
      upperNote: 'INCLUSIVE',
    });
    const [feature] = parseSuaXml(buildSaaDocument(component), 'inclusive.xml');
    assert(feature !== undefined);
    expect(feature.ceiling.inclusive).not.toBe(false);
  });
});

describe('parseSuaXml with incomplete boundaries', () => {
  it('skips a component whose volume has no exterior ring', () => {
    const warn = silenceWarnings();
    expect(parseSuaXml(buildSaaDocument(baseWithRing('')), 'no-exterior.xml')).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No exterior Ring'));
  });

  it('skips a component whose exterior is neither a LinearRing nor a Ring', () => {
    const warn = silenceWarnings();
    expect(parseSuaXml(buildSaaDocument(baseWithRing('<Polygon/>')), 'odd-exterior.xml')).toEqual(
      [],
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No exterior Ring'));
  });

  it('skips a ring with too few usable positions', () => {
    const warn = silenceWarnings();
    const xml = buildSaaDocument(baseWithRing(ring(line('-122 38', '-121.9 38'))));
    expect(parseSuaXml(xml, 'short.xml')).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Too few coordinates'));
  });

  it('ignores curve members without segments and positions that cannot be read', () => {
    const warn = silenceWarnings();
    const xml = buildSaaDocument(
      baseWithRing(
        `<Ring><curveMember><Curve gml:id="C0"></Curve></curveMember><curveMember><Curve gml:id="C1"><segments>${line(
          '-122 38',
          '-121.95',
          'abc def',
          '-121.9 38',
          '-121.9 38.1',
          '-122 38.1',
          '-122 38',
        )}</segments></Curve></curveMember></Ring>`,
      ),
    );
    const [feature] = parseSuaXml(xml, 'messy.xml');
    assert(feature !== undefined);
    expect(feature.boundary.coordinates[0]?.length).toBe(5);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Malformed pos "-121.95"'));
  });

  it('builds a full circle from a CircleByCenterPoint', () => {
    const xml = buildSaaDocument(
      baseWithRing(ring(circle('-122 38', '<radius uom="NM">5</radius>'))),
    );
    const [feature] = parseSuaXml(xml, 'circle.xml');
    assert(feature !== undefined);
    const coordinates = feature.boundary.coordinates[0];
    assert(coordinates !== undefined && coordinates.length > 30);
    for (const [lon, lat] of coordinates) {
      expect(greatCircle.distanceNm(38, -122, lat!, lon!)).toBeCloseTo(5, 1);
    }
  });

  it('reads a radius published without a unit as nautical miles', () => {
    const xml = buildSaaDocument(baseWithRing(ring(circle('-122 38', '<radius>5</radius>'))));
    const [lon, lat] = parseSuaXml(xml, 'no-unit.xml')[0]?.boundary.coordinates[0]?.[0] ?? [];
    assert(lon !== undefined && lat !== undefined);
    expect(greatCircle.distanceNm(38, -122, lat, lon)).toBeCloseTo(5, 1);
  });

  it('converts radii published in feet', () => {
    const xml = buildSaaDocument(
      baseWithRing(ring(circle('-122 38', '<radius uom="FT">30380.6</radius>'))),
    );
    const [lon, lat] = parseSuaXml(xml, 'feet.xml')[0]?.boundary.coordinates[0]?.[0] ?? [];
    assert(lon !== undefined && lat !== undefined);
    expect(greatCircle.distanceNm(38, -122, lat, lon)).toBeCloseTo(5, 1);
  });

  it('reads a radius in an unknown unit as nautical miles and says so', () => {
    const warn = silenceWarnings();
    const xml = buildSaaDocument(
      baseWithRing(ring(circle('-122 38', '<radius uom="KM">5</radius>'))),
    );
    const [lon, lat] = parseSuaXml(xml, 'km.xml')[0]?.boundary.coordinates[0]?.[0] ?? [];
    assert(lon !== undefined && lat !== undefined);
    expect(greatCircle.distanceNm(38, -122, lat, lon)).toBeCloseTo(5, 1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unknown radius unit "KM"'));
  });

  it.each([
    ['a missing center', circle(undefined, '<radius uom="NM">5</radius>'), 'Missing circle center'],
    [
      'a malformed center',
      circle('-122', '<radius uom="NM">5</radius>'),
      'Malformed circle center',
    ],
    [
      'a radius that is not a number',
      circle('-122 38', '<radius uom="NM">wide</radius>'),
      'Incomplete circle parameters',
    ],
    [
      'a missing arc center',
      arc(undefined, '<radius uom="NM">5</radius>', 0, 90),
      'Missing arc center',
    ],
    [
      'a malformed arc center',
      arc('-122', '<radius uom="NM">5</radius>', 0, 90),
      'Malformed arc center',
    ],
    [
      'an arc without an end angle',
      arc('-122 38', '<radius uom="NM">5</radius>', 0),
      'Incomplete arc parameters',
    ],
  ])('skips a curve member with %s and keeps the rest of the ring', (_label, member, message) => {
    const warn = silenceWarnings();
    const [feature] = parseSuaXml(
      buildSaaDocument(baseWithRing(ring(SQUARE, member))),
      'bad-member.xml',
    );
    assert(feature !== undefined);
    expect(feature.boundary.coordinates[0]?.length).toBe(5);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(message));
  });

  it('closes a ring that starts with an arc on the published line point', () => {
    // A 5 nm arc from due east (0 deg) round to due north (90 deg) of the
    // center, then a line that leaves the arc's end and returns to a point
    // 0.2 nm from the arc's computed start: the published line point is kept
    // and the arc's start is dropped.
    const center = { lon: -122, lat: 38 };
    const east = greatCircle.destination(center.lat, center.lon, 90, 5);
    const north = greatCircle.destination(center.lat, center.lon, 0, 5);
    const nearEast = greatCircle.destination(east.lat, east.lon, 0, 0.2);
    const xml = buildSaaDocument(
      baseWithRing(
        ring(
          arc(`${center.lon} ${center.lat}`, '<radius uom="NM">5</radius>', 0, 90),
          line(`${north.lon} ${north.lat}`, '-121.8 38.2', `${nearEast.lon} ${nearEast.lat}`),
        ),
      ),
    );
    const [feature] = parseSuaXml(xml, 'arc-first.xml');
    const coordinates = feature?.boundary.coordinates[0];
    assert(coordinates !== undefined);
    const hasVertexNear = (lon: number, lat: number): boolean =>
      coordinates.some(([x, y]) => Math.abs(x! - lon) < 1e-7 && Math.abs(y! - lat) < 1e-7);
    expect(coordinates[0]).toEqual(coordinates[coordinates.length - 1]);
    expect(hasVertexNear(nearEast.lon, nearEast.lat)).toBe(true);
    expect(hasVertexNear(east.lon, east.lat)).toBe(false);
  });
});

describe('parseSuaXml metadata', () => {
  it('leaves the state, schedule and controlling facility unset when the document does not give them', () => {
    const xml = buildSaaDocument(baseWithRing(linearRing(0)))
      .replace(
        '<administrativeArea>CALIFORNIA</administrativeArea>',
        '<administrativeArea>ATLANTIS</administrativeArea>',
      )
      .replace(/Times of use\.[^.]*\.[^.]*\.\s*/, '')
      .replace('<designator>ZOA</designator>', '');
    const [feature] = parseSuaXml(xml, 'sparse.xml');
    assert(feature !== undefined);
    expect(feature.state).toBe(null);
    expect(feature.scheduleDescription).toBe(null);
    expect(feature.controllingFacility).toBe(null);
  });

  it('leaves the state and schedule unset when the airspace has no administrative area and no annotations', () => {
    const xml = buildSaaDocument(baseWithRing(linearRing(0)))
      .replace('<administrativeArea>CALIFORNIA</administrativeArea>', '')
      .replace(/<annotation>[\s\S]*?<\/annotation>/g, '');
    const [feature] = parseSuaXml(xml, 'bare.xml');
    assert(feature !== undefined);
    expect(feature.state).toBe(null);
    expect(feature.scheduleDescription).toBe(null);
  });

  it('reads the schedule from the legal definition among other annotations', () => {
    const xml = buildSaaDocument(baseWithRing(linearRing(0))).replace(
      '<annotation>',
      '<annotation><Note><propertyName>remark</propertyName><translatedNote><LinguisticNote><note>Other text.</note></LinguisticNote></translatedNote></Note></annotation><annotation><Note><propertyName>legalDefinitionType</propertyName></Note></annotation><annotation>',
    );
    const [feature] = parseSuaXml(xml, 'annotated.xml');
    expect(feature?.scheduleDescription).toBe('0800-1700 Monday-Friday; other times by NOTAM.');
  });
});

describe('parseSua', () => {
  /**
   * Writes an SAA subscriber ZIP (an outer ZIP holding the inner
   * Saa_Sub_File.zip, or other entries) to a temporary directory.
   */
  function writeSubscriberZip(dir: string, inner: AdmZip | undefined): string {
    const outer = new AdmZip();
    if (inner === undefined) {
      outer.addFile('README.txt', Buffer.from('no inner archive'));
    } else {
      outer.addFile('Saa_Sub_File.zip', inner.toBuffer());
    }
    const path = join(dir, 'SaaSubscriberFile.zip');
    writeFileSync(path, outer.toBuffer());
    return path;
  }

  it('parses every XML file of the inner archive and skips one that cannot be parsed', () => {
    const warn = silenceWarnings();
    const dir = mkdtempSync(join(tmpdir(), 'parse-sua-'));
    try {
      const inner = new AdmZip();
      inner.addFile('MTEST1.xml', Buffer.from(buildSaaDocument(baseWithRing(linearRing(0)))));
      inner.addFile('BROKEN.xml', Buffer.from('<SaaMessage><!-- never closed'));
      inner.addFile('notes.txt', Buffer.from('not an airspace'));
      const features = parseSua(writeSubscriberZip(dir, inner));
      expect(features.length).toBe(1);
      expect(features[0]?.identifier).toBe('MTEST1');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to parse "BROKEN.xml"'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('throws when the subscriber archive has no inner Saa_Sub_File.zip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'parse-sua-'));
    try {
      expect(() => parseSua(writeSubscriberZip(dir, undefined))).toThrow(/Saa_Sub_File\.zip/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
