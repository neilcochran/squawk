/**
 * @packageDocumentation
 * Shared helpers used by multiple tool modules. Internal to `@squawk/mcp` and
 * not re-exported from the package entrypoint.
 */

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
