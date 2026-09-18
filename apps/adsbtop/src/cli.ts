#!/usr/bin/env node

// React picks its build when it is first imported: outside `production` it
// loads the development build, which records a `performance.measure()` entry
// on every render. Node never evicts those entries, so a long-running session
// grows without bound. Static imports are hoisted above any statement, so the
// app is loaded with a dynamic import to guarantee NODE_ENV is set first. An
// explicitly set NODE_ENV is left untouched.
process.env.NODE_ENV ??= 'production';

await import('./main.js');
