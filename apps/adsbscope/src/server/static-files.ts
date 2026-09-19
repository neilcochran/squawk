import { extname, resolve, sep } from 'node:path';

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Maps a request path onto a file under the UI's build directory. `/` and
 * any path ending in `/` resolve to that directory's `index.html`. Returns
 * undefined for a path that does not decode, contains a NUL byte, or would
 * resolve outside `publicDir`, so a crafted `..` sequence can never reach
 * the rest of the filesystem.
 *
 * @param publicDir - Absolute path of the directory the UI was built into.
 * @param urlPath - The request URL's path component, still percent-encoded.
 * @returns The absolute file path to serve, or undefined if the path is not servable.
 */
export function resolveStaticPath(publicDir: string, urlPath: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return undefined;
  }
  if (decoded.includes('\0')) {
    return undefined;
  }
  const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const root = resolve(publicDir);
  const candidate = resolve(root, `.${sep}${relative}`);
  if (!candidate.startsWith(`${root}${sep}`)) {
    return undefined;
  }
  return candidate;
}

/**
 * Picks the `Content-Type` for a static file from its extension.
 *
 * @param filePath - Path of the file being served.
 * @returns The content type, or `application/octet-stream` for an unknown extension.
 */
export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPE_BY_EXTENSION[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}
