/**
 * Vitest setup file. Imported automatically before each test file via the
 * `test.setupFiles` entry in `vite.config.ts`. Pulls in the
 * `@testing-library/jest-dom` matchers (`toBeInTheDocument`,
 * `toHaveTextContent`, `toHaveClass`, etc.) so component specs can use
 * them as drop-in extensions to Vitest's `expect`. Also registers an
 * `afterEach(cleanup)` so each test starts with a fresh DOM - Vitest does
 * not enable test-framework globals by default, so RTL's auto-cleanup
 * cannot register itself and components from prior tests would otherwise
 * accumulate in the document.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
