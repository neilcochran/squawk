import { describe, it, expect } from 'vitest';

import * as browserEntry from './browser.js';

describe('browser entry', () => {
  it('exposes createIcaoRegistry', () => {
    expect(typeof browserEntry.createIcaoRegistry).toBe('function');
  });

  it('does not expose parseFaaRegistryZip', () => {
    expect('parseFaaRegistryZip' in browserEntry).toBe(false);
  });
});
