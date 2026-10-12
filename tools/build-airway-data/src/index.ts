import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parseNasrArgs } from '@squawk/build-shared';
import type { Airway, AirwayType } from '@squawk/types';
import { AWY_TYPE_MAP, ATS_TYPE_MAP } from '@squawk/types';

import type { AirwaySourceRecords } from './assemble-airways.js';
import { assembleAirway } from './assemble-airways.js';
import type { AirwayPointRecord, AirwaySegmentRecord } from './build-waypoint.js';
import { parseAts1, parseAts2, parseAts4, parseAtsRemark } from './parse-ats.js';
import { parseAwy1, parseAwy2, parseAwy4, parseAwyRemark } from './parse-awy.js';
import { writeOutput } from './write-output.js';

/** Fixed-width data files within the NASR subscription directory. */
const AWY_FILE = 'AWY.txt';
const ATS_FILE = 'ATS.txt';

/**
 * Builds the unique airway key from designation and type character.
 */
function airwayKey(designation: string, airwayTypeChar: string): string {
  return `${designation}|${airwayTypeChar}`;
}

/**
 * Returns the source record set for an airway, creating it on first use.
 */
function sourceFor(
  sources: Map<string, AirwaySourceRecords>,
  designation: string,
  airwayTypeChar: string,
): AirwaySourceRecords {
  const key = airwayKey(designation, airwayTypeChar);
  let source = sources.get(key);
  if (source === undefined) {
    source = {
      designation,
      airwayTypeChar,
      segments: new Map<number, AirwaySegmentRecord>(),
      points: new Map<number, AirwayPointRecord>(),
      pointRemarks: new Map<number, string[]>(),
      remarks: [],
    };
    sources.set(key, source);
  }
  return source;
}

/**
 * Adds one remark line to a point's remark list.
 */
function addPointRemark(source: AirwaySourceRecords, sequenceNumber: number, text: string): void {
  const lines = source.pointRemarks.get(sequenceNumber) ?? [];
  lines.push(text);
  source.pointRemarks.set(sequenceNumber, lines);
}

/**
 * Reads the non-empty lines of a fixed-width NASR file.
 */
function readLines(filePath: string): string[] {
  return readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
}

/**
 * Groups the records of AWY.txt by airway. Changeover records (AWY3, AWY5)
 * are not modelled.
 */
function readAwyFile(filePath: string): Map<string, AirwaySourceRecords> {
  const sources = new Map<string, AirwaySourceRecords>();
  for (const line of readLines(filePath)) {
    const recordType = line.substring(0, 4);
    if (recordType === 'AWY1') {
      const rec = parseAwy1(line);
      sourceFor(sources, rec.designation, rec.airwayTypeChar).segments.set(rec.sequenceNumber, rec);
    } else if (recordType === 'AWY2') {
      const rec = parseAwy2(line);
      sourceFor(sources, rec.designation, rec.airwayTypeChar).points.set(rec.sequenceNumber, rec);
    } else if (recordType === 'AWY4') {
      const rec = parseAwy4(line);
      addPointRemark(
        sourceFor(sources, rec.designation, rec.airwayTypeChar),
        rec.sequenceNumber,
        rec.text,
      );
    } else if (recordType === 'RMK ') {
      const rec = parseAwyRemark(line);
      sourceFor(sources, rec.designation, rec.airwayTypeChar).remarks.push(rec.text);
    }
  }
  return sources;
}

/**
 * Groups the records of ATS.txt by airway. Changeover records (ATS3, ATS5)
 * are not modelled.
 */
function readAtsFile(filePath: string): Map<string, AirwaySourceRecords> {
  const sources = new Map<string, AirwaySourceRecords>();
  for (const line of readLines(filePath)) {
    const recordType = line.substring(0, 4);
    if (recordType === 'ATS1') {
      const rec = parseAts1(line);
      sourceFor(sources, rec.fullDesignation, rec.airwayTypeChar).segments.set(
        rec.sequenceNumber,
        rec,
      );
    } else if (recordType === 'ATS2') {
      const rec = parseAts2(line);
      sourceFor(sources, rec.fullDesignation, rec.airwayTypeChar).points.set(
        rec.sequenceNumber,
        rec,
      );
    } else if (recordType === 'ATS4') {
      const rec = parseAts4(line);
      addPointRemark(
        sourceFor(sources, rec.fullDesignation, rec.airwayTypeChar),
        rec.sequenceNumber,
        rec.text,
      );
    } else if (recordType === 'RMK ') {
      const rec = parseAtsRemark(line);
      sourceFor(sources, rec.fullDesignation, rec.airwayTypeChar).remarks.push(rec.text);
    }
  }
  return sources;
}

/**
 * Determines the AirwayType from an AWY.txt designation string.
 * The first character indicates the type (V, J, Q, T, G, R, A, B).
 */
function awyType(designation: string): AirwayType | undefined {
  return AWY_TYPE_MAP[designation.charAt(0)];
}

/**
 * Determines the AirwayType from an ATS.txt designation, whose first two
 * characters are the route category prefix.
 */
function atsType(designation: string): AirwayType | undefined {
  return ATS_TYPE_MAP[designation.substring(0, 2)];
}

/**
 * Assembles every airway of one file and logs what was dropped or could not
 * be placed.
 */
function buildAirways(
  file: string,
  sources: Map<string, AirwaySourceRecords>,
  typeOf: (designation: string) => AirwayType | undefined,
): Airway[] {
  const airways: Airway[] = [];
  const untyped: string[] = [];
  const unplacedCrossingAltitudes: string[] = [];
  let attachedCrossingAltitudes = 0;
  let unusableSegments = 0;

  for (const source of sources.values()) {
    if (source.segments.size === 0) {
      continue;
    }
    const type = typeOf(source.designation);
    if (type === undefined) {
      untyped.push(source.designation);
      continue;
    }
    const result = assembleAirway(type, source);
    attachedCrossingAltitudes += result.crossingAltitudes.attached;
    unplacedCrossingAltitudes.push(...result.crossingAltitudes.unplaced);
    unusableSegments += result.unusableSegments;
    if (result.airway !== undefined) {
      airways.push(result.airway);
    }
  }

  const waypointCount = airways.reduce((sum, a) => sum + a.waypoints.length, 0);
  console.log(
    `[index] Parsed ${airways.length} airways (${waypointCount} waypoints) from ${file}.`,
  );
  console.log(
    `[index] ${file}: ${attachedCrossingAltitudes} crossing altitudes attached to their named point, ${unusableSegments} unusable segments.`,
  );
  for (const message of unplacedCrossingAltitudes) {
    console.warn(`[index] ${file}: crossing altitude left off: ${message}`);
  }
  if (untyped.length > 0) {
    console.warn(
      `[index] ${file}: dropped ${untyped.length} routes with no airway type: ${untyped.join(', ')}`,
    );
  }
  return airways;
}

/**
 * Main entry point. Parses CLI arguments, reads AWY.txt and ATS.txt,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const parsed = parseNasrArgs({
    argv: process.argv.slice(2),
    defaultOutputPath: resolve(
      import.meta.dirname,
      '../../../packages/libs/airway-data/data/airways.json.gz',
    ),
  });
  if ('message' in parsed) {
    process.stderr.write(parsed.message);
    process.exitCode = 1;
    return;
  }
  const { subscriptionDir, nasrCycleDate, outputPath, cleanup } = parsed;

  try {
    console.log(`[index] Parsing ${AWY_FILE}...`);
    const awyAirways = buildAirways(
      AWY_FILE,
      readAwyFile(join(subscriptionDir, AWY_FILE)),
      awyType,
    );

    console.log(`[index] Parsing ${ATS_FILE}...`);
    const atsAirways = buildAirways(
      ATS_FILE,
      readAtsFile(join(subscriptionDir, ATS_FILE)),
      atsType,
    );

    const allAirways = [...awyAirways, ...atsAirways];
    allAirways.sort((a, b) => a.designation.localeCompare(b.designation));

    console.log(`[index] Total: ${allAirways.length} airways.`);

    await writeOutput(allAirways, nasrCycleDate, outputPath);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  // eslint-disable-next-line n/no-process-exit -- last-resort fatal handler; exiting guarantees a non-zero status even when a pending download or file handle would otherwise hold the process open.
  process.exit(1);
});
