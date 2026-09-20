import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// Specs that opt into jsdom get their rendered trees unmounted between tests.
// Node-environment specs (the server, and pure UI helpers) have no DOM, and
// importing the DOM testing library there would be wasted work.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
