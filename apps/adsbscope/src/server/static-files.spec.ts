import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { contentTypeFor, resolveStaticPath } from './static-files.js';

const PUBLIC_DIR = resolve('some', 'public');

describe('resolveStaticPath', () => {
  it('serves index.html for the root and for any directory path', () => {
    expect(resolveStaticPath(PUBLIC_DIR, '/')).toBe(join(PUBLIC_DIR, 'index.html'));
    expect(resolveStaticPath(PUBLIC_DIR, '/docs/')).toBe(join(PUBLIC_DIR, 'docs', 'index.html'));
  });

  it('resolves a nested asset path', () => {
    expect(resolveStaticPath(PUBLIC_DIR, '/assets/index-abc.js')).toBe(
      join(PUBLIC_DIR, 'assets', 'index-abc.js'),
    );
  });

  it('decodes percent-encoded characters', () => {
    expect(resolveStaticPath(PUBLIC_DIR, '/my%20file.css')).toBe(join(PUBLIC_DIR, 'my file.css'));
  });

  it('refuses a path that climbs out of the public directory', () => {
    expect(resolveStaticPath(PUBLIC_DIR, '/../secret.txt')).toBeUndefined();
    expect(resolveStaticPath(PUBLIC_DIR, '/assets/../../secret.txt')).toBeUndefined();
    expect(resolveStaticPath(PUBLIC_DIR, '/%2e%2e/%2e%2e/secret.txt')).toBeUndefined();
    expect(resolveStaticPath(PUBLIC_DIR, '/..%5c..%5csecret.txt')).not.toBe(
      resolve(PUBLIC_DIR, '..', '..', 'secret.txt'),
    );
  });

  it('refuses the public directory itself', () => {
    expect(resolveStaticPath(PUBLIC_DIR, '/assets/../..')).toBeUndefined();
  });

  it('allows a path that climbs but stays inside the public directory', () => {
    expect(resolveStaticPath(PUBLIC_DIR, '/assets/../index.html')).toBe(
      join(PUBLIC_DIR, 'index.html'),
    );
  });

  it('refuses a malformed escape sequence or a NUL byte', () => {
    expect(resolveStaticPath(PUBLIC_DIR, '/%E0%A4%A')).toBeUndefined();
    expect(resolveStaticPath(PUBLIC_DIR, '/index.html%00.png')).toBeUndefined();
  });
});

describe('contentTypeFor', () => {
  it('maps known extensions, case-insensitively', () => {
    expect(contentTypeFor('index.html')).toBe('text/html; charset=utf-8');
    expect(contentTypeFor('assets/index-abc.js')).toBe('text/javascript; charset=utf-8');
    expect(contentTypeFor('assets/index-abc.CSS')).toBe('text/css; charset=utf-8');
    expect(contentTypeFor('favicon.svg')).toBe('image/svg+xml');
  });

  it('falls back to a binary type for an unknown extension', () => {
    expect(contentTypeFor('data.bin')).toBe('application/octet-stream');
    expect(contentTypeFor('LICENSE')).toBe('application/octet-stream');
  });
});
