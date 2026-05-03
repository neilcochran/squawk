import { describe, it, expect, assert } from 'vitest';

import type { Procedure } from '@squawk/types';

import { createProcedureResolver } from './resolver.js';

describe('expand - edge cases', () => {
  it('returns undefined when expanding a procedure with no common route and no transition argument', () => {
    const proc: Procedure = {
      name: 'EMPTY',
      identifier: 'EMPTY1',
      type: 'SID',
      airports: ['KAAA'],
      commonRoutes: [],
      transitions: [],
    };
    const resolver = createProcedureResolver({ data: [proc] });
    expect(resolver.expand('KAAA', 'EMPTY1')).toBe(undefined);
  });

  it('returns transition legs when expanding with transition but no common route', () => {
    const proc: Procedure = {
      name: 'TRONLY',
      identifier: 'TRONLY1',
      type: 'SID',
      airports: ['KAAA'],
      commonRoutes: [],
      transitions: [{ name: 'EXIT1', legs: [{ pathTerminator: 'TF', fixIdentifier: 'EXIT' }] }],
    };
    const resolver = createProcedureResolver({ data: [proc] });
    const result = resolver.expand('KAAA', 'TRONLY1', 'EXIT1');
    assert(result !== undefined);
    expect(result.legs.length).toBe(1);
    expect(result.legs[0]?.fixIdentifier).toBe('EXIT');
  });

  it('returns common route legs unchanged when transition has zero legs', () => {
    const proc: Procedure = {
      name: 'EMPTYTR',
      identifier: 'EMPTYTR1',
      type: 'SID',
      airports: ['KAAA'],
      commonRoutes: [{ legs: [{ pathTerminator: 'IF', fixIdentifier: 'A' }], airports: ['KAAA'] }],
      transitions: [{ name: 'EXIT1', legs: [] }],
    };
    const resolver = createProcedureResolver({ data: [proc] });
    const result = resolver.expand('KAAA', 'EMPTYTR1', 'EXIT1');
    assert(result !== undefined);
    expect(result.legs.length).toBe(1);
    expect(result.legs[0]?.fixIdentifier).toBe('A');
  });

  it('returns transition legs unchanged when common route has zero legs', () => {
    const proc: Procedure = {
      name: 'EMPTYRT',
      identifier: 'EMPTYRT1',
      type: 'SID',
      airports: ['KAAA'],
      commonRoutes: [{ legs: [], airports: ['KAAA'] }],
      transitions: [{ name: 'EXIT1', legs: [{ pathTerminator: 'TF', fixIdentifier: 'X' }] }],
    };
    const resolver = createProcedureResolver({ data: [proc] });
    const result = resolver.expand('KAAA', 'EMPTYRT1', 'EXIT1');
    assert(result !== undefined);
    expect(result.legs.length).toBe(1);
    expect(result.legs[0]?.fixIdentifier).toBe('X');
  });

  it('does not deduplicate when connecting fix identifiers differ', () => {
    const proc: Procedure = {
      name: 'NODEDUP',
      identifier: 'NODEDUP1',
      type: 'SID',
      airports: ['KAAA'],
      commonRoutes: [
        {
          legs: [
            { pathTerminator: 'IF', fixIdentifier: 'AAA' },
            { pathTerminator: 'TF', fixIdentifier: 'BBB' },
          ],
          airports: ['KAAA'],
        },
      ],
      transitions: [
        {
          name: 'EXIT1',
          legs: [
            { pathTerminator: 'TF', fixIdentifier: 'CCC' },
            { pathTerminator: 'TF', fixIdentifier: 'DDD' },
          ],
        },
      ],
    };
    const resolver = createProcedureResolver({ data: [proc] });
    const result = resolver.expand('KAAA', 'NODEDUP1', 'EXIT1');
    assert(result !== undefined);
    expect(result.legs.length).toBe(4);
    expect(result.legs.map((l) => l.fixIdentifier)).toEqual(['AAA', 'BBB', 'CCC', 'DDD']);
  });

  it('does not deduplicate when last leg of first segment has no fix identifier', () => {
    const proc: Procedure = {
      name: 'NOFIX',
      identifier: 'NOFIX1',
      type: 'SID',
      airports: ['KAAA'],
      commonRoutes: [
        {
          legs: [{ pathTerminator: 'VA' }],
          airports: ['KAAA'],
        },
      ],
      transitions: [
        {
          name: 'EXIT1',
          legs: [{ pathTerminator: 'TF', fixIdentifier: 'XXX' }],
        },
      ],
    };
    const resolver = createProcedureResolver({ data: [proc] });
    const result = resolver.expand('KAAA', 'NOFIX1', 'EXIT1');
    assert(result !== undefined);
    expect(result.legs.length).toBe(2);
  });

  it('returns common route last for STAR enroute (non-runway) transitions', () => {
    const proc: Procedure = {
      name: 'STARTR',
      identifier: 'STARTR1',
      type: 'STAR',
      airports: ['KAAA'],
      commonRoutes: [
        { legs: [{ pathTerminator: 'TF', fixIdentifier: 'COMMON' }], airports: ['KAAA'] },
      ],
      transitions: [{ name: 'ENRT1', legs: [{ pathTerminator: 'TF', fixIdentifier: 'ENRT' }] }],
    };
    const resolver = createProcedureResolver({ data: [proc] });
    const result = resolver.expand('KAAA', 'STARTR1', 'ENRT1');
    assert(result !== undefined);
    // Enroute STAR transitions come first
    expect(result.legs[0]?.fixIdentifier).toBe('ENRT');
  });

  it('returns common route first for STAR runway (RW*) transitions', () => {
    const proc: Procedure = {
      name: 'STARRWY',
      identifier: 'STARRWY1',
      type: 'STAR',
      airports: ['KAAA'],
      commonRoutes: [
        { legs: [{ pathTerminator: 'TF', fixIdentifier: 'COMMON' }], airports: ['KAAA'] },
      ],
      transitions: [{ name: 'RW04L', legs: [{ pathTerminator: 'TF', fixIdentifier: 'RWY' }] }],
    };
    const resolver = createProcedureResolver({ data: [proc] });
    const result = resolver.expand('KAAA', 'STARRWY1', 'RW04L');
    assert(result !== undefined);
    expect(result.legs[0]?.fixIdentifier).toBe('COMMON');
  });
});
