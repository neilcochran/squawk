import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** Default port for the viewer server. */
const DEFAULT_PORT = 3117;

/** Resolved paths to built data files. */
const AIRSPACE_PATH = resolve(
  import.meta.dirname,
  '../../../packages/airspace-data/data/airspace.geojson',
);
const AIRPORTS_PATH = resolve(
  import.meta.dirname,
  '../../../packages/airport-data/data/airports.json.gz',
);

/** Path to the viewer HTML file. */
const VIEWER_HTML_PATH = resolve(import.meta.dirname, '../viewer.html');

interface LayerConfig {
  /** Whether this layer is available (data file exists). */
  available: boolean;
  /** Whether this layer is enabled via CLI flags. */
  enabled: boolean;
}

/**
 * Prints usage instructions to stderr and exits with code 1.
 */
function printUsageAndExit(): never {
  process.stderr.write(
    'Usage: node dist/index.js [options]\n\n' +
      'Options:\n' +
      '  --airspace       Enable the airspace layer (Class B/C/D, SUA)\n' +
      '  --airports       Enable the airports layer (runways, frequencies)\n' +
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
  const airspaceLayer: LayerConfig = { available: existsSync(AIRSPACE_PATH), enabled: false };
  const airportsLayer: LayerConfig = { available: existsSync(AIRPORTS_PATH), enabled: false };
  const layers = { airspace: airspaceLayer, airports: airportsLayer };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--airspace') {
      airspaceLayer.enabled = true;
      explicitLayers = true;
    } else if (arg === '--airports') {
      airportsLayer.enabled = true;
      explicitLayers = true;
    } else if (arg === '--all') {
      for (const layer of Object.values(layers)) {
        layer.enabled = true;
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
    } else {
      process.stderr.write(`Unknown argument: ${arg}\n`);
      printUsageAndExit();
    }
  }

  // Default to all available layers if no explicit flags.
  if (!explicitLayers) {
    for (const layer of Object.values(layers)) {
      layer.enabled = true;
    }
  }

  // Report layer status.
  for (const [name, config] of Object.entries(layers)) {
    if (config.enabled && !config.available) {
      console.log(`[map-viewer] Layer "${name}" enabled but data file not found - skipping.`);
      config.enabled = false;
    } else if (config.enabled) {
      console.log(`[map-viewer] Layer "${name}" enabled.`);
    }
  }

  const enabledCount = Object.values(layers).filter((l) => l.enabled).length;
  if (enabledCount === 0) {
    process.stderr.write('Error: no layers available. Build the data packages first.\n');
    process.exit(1);
  }

  // Build the config object that the HTML client will fetch.
  const clientConfig = {
    layers: Object.fromEntries(
      Object.entries(layers).map(([name, config]) => [name, config.enabled]),
    ),
  };

  // Pre-load data into memory for fast serving.
  const dataCache = new Map<string, string>();

  if (layers.airspace.enabled) {
    console.log('[map-viewer] Loading airspace data...');
    dataCache.set('/data/airspace', readFileSync(AIRSPACE_PATH, 'utf-8'));
    console.log('[map-viewer] Airspace data loaded.');
  }

  if (layers.airports.enabled) {
    console.log('[map-viewer] Loading airport data...');
    const compressed = readFileSync(AIRPORTS_PATH);
    dataCache.set('/data/airports', gunzipSync(compressed).toString('utf-8'));
    console.log('[map-viewer] Airport data loaded.');
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

    const cached = dataCache.get(url);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(cached);
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
