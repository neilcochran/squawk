import { writeFile } from 'node:fs/promises';

import type { Aircraft } from '@squawk/types';

import type { ColumnDef, RenderContext } from './columns.js';

/**
 * The file name a `[W]` snapshot is written to: `adsbtop-YYYYMMDD-HHMMSS.csv`
 * in local time, so consecutive snapshots sort chronologically and never
 * collide within a session.
 *
 * @param nowMs - The time of the snapshot.
 * @returns The file name, without a directory.
 */
export function snapshotFileName(nowMs: number): string {
  const date = new Date(nowMs);
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `adsbtop-${stamp}.csv`;
}

/**
 * Quotes a CSV field when it contains a comma, a double quote, or a line
 * break, doubling any embedded quotes, per the common CSV convention.
 */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Builds the CSV for a `[W]` snapshot: one header row of column headers,
 * then one row per aircraft with each cell rendered exactly as the table
 * shows it (units and placeholders included), so the file is a faithful
 * copy of what was on screen rather than a raw data export.
 *
 * @param aircraft - The aircraft to write, in display order (already sorted and filtered).
 * @param columns - The visible columns, in display order.
 * @param context - The current time and location, for the column renderers.
 * @returns The CSV text, lines terminated with `\n` and a trailing newline.
 */
export function buildSnapshotCsv(
  aircraft: readonly Aircraft[],
  columns: readonly ColumnDef[],
  context: RenderContext,
): string {
  const header = columns.map((column) => csvField(column.header)).join(',');
  const rows = aircraft.map((candidate) =>
    columns.map((column) => csvField(column.render(candidate, context))).join(','),
  );
  return [header, ...rows].join('\n') + '\n';
}

/**
 * Writes a snapshot to `fileName` in the current working directory. The
 * default writer behind `[W]`; injectable in `App` so tests never touch
 * the disk.
 *
 * @param fileName - The file to write, relative to the working directory.
 * @param contents - The CSV text.
 * @returns Resolves when written; rejects with the file system error otherwise.
 */
export function writeSnapshotFile(fileName: string, contents: string): Promise<void> {
  return writeFile(fileName, contents, 'utf8');
}
