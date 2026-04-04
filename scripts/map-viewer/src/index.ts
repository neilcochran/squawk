import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** Default port for the viewer server. */
const DEFAULT_PORT = 3117;

/** Resolved base paths. */
const DATA_ROOT = resolve(import.meta.dirname, '../../../packages');
const VIEWER_HTML_PATH = resolve(import.meta.dirname, '../viewer.html');
const STATIC_DIR = resolve(import.meta.dirname, '../static');

/** Content-Type mapping for static files. */
const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
};

interface LayerDefinition {
  /** Layer name used for CLI flags and data endpoints. */
  name: string;
  /** Path to the built data file. */
  dataPath: string;
  /** Whether the data file is gzip-compressed. */
  gzipped: boolean;
}

/** All supported map layers. Add new layers here. */
const LAYER_DEFINITIONS: LayerDefinition[] = [
  {
    name: 'airspace',
    dataPath: resolve(DATA_ROOT, 'airspace-data/data/airspace.geojson.gz'),
    gzipped: true,
  },
  {
    name: 'airports',
    dataPath: resolve(DATA_ROOT, 'airport-data/data/airports.json.gz'),
    gzipped: true,
  },
  {
    name: 'navaids',
    dataPath: resolve(DATA_ROOT, 'navaid-data/data/navaids.json.gz'),
    gzipped: true,
  },
  { name: 'fixes', dataPath: resolve(DATA_ROOT, 'fix-data/data/fixes.json.gz'), gzipped: true },
  {
    name: 'airways',
    dataPath: resolve(DATA_ROOT, 'airway-data/data/airways.json.gz'),
    gzipped: true,
  },
  {
    name: 'procedures',
    dataPath: resolve(DATA_ROOT, 'procedure-data/data/procedures.json.gz'),
    gzipped: true,
  },
];

interface LayerState {
  /** Whether the data file exists on disk. */
  available: boolean;
  /** Whether the user enabled this layer via CLI flags. */
  enabled: boolean;
}

/**
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(): never {
  const flagList = LAYER_DEFINITIONS.map(
    (l) => `  --${l.name.padEnd(14)} Enable the ${l.name} layer`,
  ).join('\n');
  process.stderr.write(
    'Usage: node dist/index.js [options]\n\n' +
      'Options:\n' +
      flagList +
      '\n' +
      '  --all            Enable all available layers (default if no flags given)\n' +
      '  --port <number>  Port to listen on (default: 3117)\n' +
      '  --help           Show this help message\n',
  );
  process.exit(1);
}

/**
 * Main entry point. Parses CLI arguments, validates data availability,
 * and starts the HTTP server.
 */
function main(): void {
  const args = process.argv.slice(2);

  let port = DEFAULT_PORT;
  let explicitLayers = false;

  // Build layer state map from definitions.
  const layers = new Map<string, LayerState>();
  for (const def of LAYER_DEFINITIONS) {
    layers.set(def.name, { available: existsSync(def.dataPath), enabled: false });
  }

  // Parse CLI arguments.
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;

    if (arg === '--all') {
      for (const state of layers.values()) {
        state.enabled = true;
      }
      explicitLayers = true;
    } else if (arg === '--port') {
      const next = args[i + 1];
      if (!next) {
        process.stderr.write('Error: --port requires a number.\n');
        printUsageAndExit();
      }
      port = parseInt(next, 10);
      if (Number.isNaN(port)) {
        process.stderr.write(`Error: invalid port "${next}".\n`);
        printUsageAndExit();
      }
      i++;
    } else if (arg === '--help') {
      printUsageAndExit();
    } else if (arg.startsWith('--')) {
      const layerName = arg.slice(2);
      const state = layers.get(layerName);
      if (state) {
        state.enabled = true;
        explicitLayers = true;
      } else {
        process.stderr.write(`Unknown argument: ${arg}\n`);
        printUsageAndExit();
      }
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      printUsageAndExit();
    }
  }

  // Default to all available layers if no explicit flags.
  if (!explicitLayers) {
    for (const state of layers.values()) {
      state.enabled = true;
    }
  }

  // Report layer status.
  for (const [name, layerState] of layers) {
    if (layerState.enabled && !layerState.available) {
      console.log(`[map-viewer] Layer "${name}" enabled but data file not found - skipping.`);
      layerState.enabled = false;
    } else if (layerState.enabled) {
      console.log(`[map-viewer] Layer "${name}" enabled.`);
    }
  }

  const enabledCount = [...layers.values()].filter((l) => l.enabled).length;
  if (enabledCount === 0) {
    process.stderr.write('Error: no layers available. Build the data packages first.\n');
    process.exit(1);
  }

  // Build the config object that the HTML client will fetch.
  const clientConfig = {
    layers: Object.fromEntries([...layers].map(([name, s]) => [name, s.enabled])),
  };

  // Pre-load enabled layer data into memory.
  const dataCache = new Map<string, string>();
  for (const def of LAYER_DEFINITIONS) {
    const layerState = layers.get(def.name);
    if (!layerState?.enabled) {
      continue;
    }
    console.log(`[map-viewer] Loading ${def.name} data...`);
    if (def.gzipped) {
      const compressed = readFileSync(def.dataPath);
      dataCache.set(`/data/${def.name}`, gunzipSync(compressed).toString('utf-8'));
    } else {
      dataCache.set(`/data/${def.name}`, readFileSync(def.dataPath, 'utf-8'));
    }
    console.log(`[map-viewer] ${def.name} data loaded.`);
  }

  const viewerHtml = readFileSync(VIEWER_HTML_PATH, 'utf-8');

  const server = createServer((req, res) => {
    const url = req.url ?? '/';

    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(viewerHtml);
      return;
    }

    if (url === '/config') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(clientConfig));
      return;
    }

    // Serve cached data endpoints.
    const cached = dataCache.get(url);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(cached);
      return;
    }

    // Serve static files (JS modules for the viewer).
    if (url.startsWith('/static/')) {
      const relativePath = url.slice('/static/'.length);
      const filePath = resolve(STATIC_DIR, relativePath);

      // Prevent path traversal outside STATIC_DIR.
      if (!filePath.startsWith(STATIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      try {
        const content = readFileSync(filePath, 'utf-8');
        const contentType = MIME_TYPES[extname(filePath)] ?? 'text/plain';
        res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, () => {
    console.log(`[map-viewer] Server running at http://localhost:${port}`);
  });
}

main();
