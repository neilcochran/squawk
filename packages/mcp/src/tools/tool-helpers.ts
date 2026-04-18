/**
 * @packageDocumentation
 * Shared helpers used by multiple tool modules. Internal to `@squawk/mcp` and
 * not re-exported from the package entrypoint.
 */

/**
 * A single per-record parse failure as returned by the AWC fetch helpers.
 * Captures the raw record text and the thrown error.
 */
export interface ParseRecordErrorLike {
  /** The raw input record that failed to parse. */
  raw: string;
  /** The error thrown by the underlying parser. */
  error: unknown;
}

/**
 * Summary form of a per-record parse failure suitable for MCP tool output.
 * The error is reduced to its message string so the structured payload
 * round-trips cleanly through JSON.
 */
export interface ParseRecordErrorSummary {
  /** The raw input record that failed to parse. */
  raw: string;
  /** Human-readable message extracted from the parser's thrown error. */
  message: string;
}

/**
 * Reduces an array of {@link ParseRecordErrorLike} entries to a JSON-friendly
 * shape. Used by every weather fetch tool to surface partial parse failures
 * in `structuredContent` without leaking thrown error objects.
 *
 * @param errors - Per-record parse errors as returned by `@squawk/weather/fetch`.
 * @returns The errors with each `error` value reduced to its message string.
 */
export function summarizeParseErrors(
  errors: readonly ParseRecordErrorLike[],
): ParseRecordErrorSummary[] {
  return errors.map((err) => ({
    raw: err.raw,
    message: err.error instanceof Error ? err.error.message : String(err.error),
  }));
}

/**
 * Runs a synchronous parser inside a tool handler and packages the outcome
 * into the MCP result shape. On success the parsed record is returned as
 * pretty JSON in `content` and as `structuredContent[resultKey]`. On failure
 * the parser message is forwarded verbatim and the result is flagged
 * `isError: true` so the model can react to the failure.
 *
 * The return type is intentionally an inline literal rather than a named
 * interface: the MCP SDK's tool-result type carries an `[x: string]: unknown`
 * index signature that nominal interfaces do not satisfy without explicit
 * declaration, while inline object types are accepted at the call site
 * through TypeScript's freshness rules.
 *
 * @param raw - The raw input string passed to the parser.
 * @param parser - A pure parser function that may throw on bad input.
 * @param resultKey - The key under which the parsed record is exposed in
 *                    `structuredContent`.
 * @returns The MCP tool result.
 */
export function runParser<T>(
  raw: string,
  parser: (raw: string) => T,
  resultKey: string,
): {
  /** Standard MCP content blocks (always a single text block here). */
  content: { type: 'text'; text: string }[];
  /** Structured payload exposed to the client, keyed by `resultKey`. */
  structuredContent: Record<string, T | null>;
  /** Set to `true` when the parser threw; omitted on success. */
  isError?: boolean;
} {
  try {
    const parsed = parser(raw);
    return {
      content: [{ type: 'text', text: JSON.stringify(parsed, null, 2) }],
      structuredContent: { [resultKey]: parsed },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Parse failed: ${message}` }],
      structuredContent: { [resultKey]: null },
      isError: true,
    };
  }
}
