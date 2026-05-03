import { describe, it, expect } from 'vitest';

import { extractErrorMessage, runParser, summarizeParseErrors } from './tool-helpers.js';

describe('extractErrorMessage', () => {
  it('returns the message field from Error instances', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('coerces non-Error throwables to their string form', () => {
    expect(extractErrorMessage('plain string')).toBe('plain string');
    expect(extractErrorMessage(42)).toBe('42');
    expect(extractErrorMessage(undefined)).toBe('undefined');
  });
});

describe('summarizeParseErrors', () => {
  it('extracts the message from Error instances', () => {
    const summarized = summarizeParseErrors([{ raw: 'X', error: new Error('boom') }]);
    expect(summarized).toEqual([{ raw: 'X', message: 'boom' }]);
  });

  it('coerces non-Error throwables to a string', () => {
    const summarized = summarizeParseErrors([{ raw: 'X', error: 'plain string' }]);
    expect(summarized).toEqual([{ raw: 'X', message: 'plain string' }]);
  });

  it('returns an empty array for an empty input', () => {
    expect(summarizeParseErrors([])).toEqual([]);
  });
});

describe('runParser', () => {
  it('returns parsed JSON content on success', () => {
    const result = runParser('input', () => ({ value: 42 }), 'parsed');
    expect(result.isError).toBe(undefined);
    expect(result.structuredContent).toEqual({ parsed: { value: 42 } });
    expect(result.content[0]?.type).toBe('text');
    expect(result.content[0]?.text).toContain('"value": 42');
  });

  it('flags isError and forwards the message when the parser throws an Error', () => {
    const result = runParser(
      'bad',
      () => {
        throw new Error('parse failed');
      },
      'parsed',
    );
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({ parsed: null });
    expect(result.content[0]?.text).toBe('Parse failed: parse failed');
  });

  it('coerces a non-Error throwable to a string in the failure path', () => {
    const result = runParser(
      'bad',
      () => {
        throw 'plain string';
      },
      'parsed',
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('Parse failed: plain string');
  });
});
