#!/usr/bin/env node
import { render } from 'ink';

import { App } from './app.js';
import { parseCliArgs, USAGE } from './cli-args.js';
import { buildFeed } from './create-feed.js';

const parsed = parseCliArgs(process.argv.slice(2));

if ('message' in parsed) {
  process.stderr.write(`${parsed.message}\n\n${USAGE}`);
  process.exit(1);
}

if (parsed.help) {
  process.stdout.write(USAGE);
  process.exit(0);
}

const feed = buildFeed(parsed);

render(
  <App
    feed={feed}
    source={parsed.source}
    host={parsed.host}
    port={parsed.port}
    location={parsed.location}
  />,
);
