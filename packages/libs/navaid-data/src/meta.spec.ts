import { describe, it, expect } from 'vitest';

import { usBundledNavaidsProperties } from './meta.js';
import { usBundledNavaids } from './node.js';

describe('usBundledNavaidsProperties', () => {
  it('matches the metadata embedded in the bundled snapshot', () => {
    // Both are written by the same build step, but only the snapshot is
    // authoritative at runtime. Regenerating one without the other would
    // leave the package reporting a cycle it is not actually serving, so
    // that drift has to fail here rather than reach a consumer.
    expect(usBundledNavaidsProperties).toEqual(usBundledNavaids.properties);
  });
});
