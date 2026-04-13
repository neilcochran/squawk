import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseNasrArgs } from '@squawk/build-shared';
import { parseStardp } from './parse-stardp.js';
import { writeOutput } from './write-output.js';

/** Fixed-width data file within the NASR subscription directory. */
const STARDP_FILE = 'STARDP.txt';

/**
 * Main entry point. Parses CLI arguments, reads STARDP.txt,
 * runs the data pipeline, and writes the output.
 */
async function main(): Promise<void> {
  const { subscriptionDir, nasrCycleDate, outputPath, cleanup } = parseNasrArgs({
    defaultOutputPath: resolve(
      import.meta.dirname,
      '../../../packages/procedure-data/data/procedures.json.gz',
    ),
  });

  try {
    const stardpPath = join(subscriptionDir, STARDP_FILE);
    console.log(`[index] Parsing ${STARDP_FILE}...`);
    const content = readFileSync(stardpPath, 'utf-8');
    const procedures = parseStardp(content);

    const sidCount = procedures.filter((p) => p.type === 'SID').length;
    const starCount = procedures.filter((p) => p.type === 'STAR').length;
    console.log(
      `[index] Parsed ${procedures.length} procedures (${sidCount} SIDs, ${starCount} STARs).`,
    );

    await writeOutput(procedures, nasrCycleDate, outputPath);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('[index] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
