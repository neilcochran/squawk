/**
 * Vitest setup file. Imported automatically before each test file via the
 * `test.setupFiles` entry in `vite.config.ts`. Pulls in the
 * `@testing-library/jest-dom` matchers (`toBeInTheDocument`,
 * `toHaveTextContent`, `toHaveClass`, etc.) so component specs can use
 * them as drop-in extensions to Vitest's `expect`.
 */
import '@testing-library/jest-dom/vitest';
