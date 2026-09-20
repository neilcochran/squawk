#!/usr/bin/env node

import { run } from './run.js';
import { installShutdownHandlers } from './shutdown.js';

const result = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});

if ('exitCode' in result) {
  process.exitCode = result.exitCode;
} else {
  installShutdownHandlers({ stop: result.running.stop, processRef: process });
}
