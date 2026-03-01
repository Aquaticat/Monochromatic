// Async iterator that yields complete newline-delimited lines from a ReadableStream.
// MCP stdio transport requires messages delimited by newlines with no embedded newlines.

/**
 * Yields complete lines from a byte stream, buffering partial reads across chunk boundaries.
 * Each yielded string has the trailing newline stripped.
 *
 * @param stream - Readable byte stream to consume (typically `Bun.stdin.stream()`).
 * @yields Individual newline-delimited lines without the trailing newline character.
 *
 * @example
 * ```ts
 * for await (const line of readLines(Bun.stdin.stream())) {
 *   console.error('received:', line);
 * }
 * ```
 */
export async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  // `buffer` accumulates partial line data between chunk boundaries.
  // Declared with `let` because string concatenation requires reassignment.
  let buffer = '';

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });

    // A single chunk may contain multiple newline-delimited messages.
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      yield buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');
    }
  }

  // Flush remaining data after stream closes without a trailing newline.
  // Not expected in normal MCP usage (clients send newline-terminated messages),
  // but logged so protocol issues are visible during debugging.
  if (buffer.length > 0) {
    console.error('[mcp-stdio] flushing trailing buffer without newline terminator:', buffer);
    yield buffer;
  }
}
