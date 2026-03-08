/**
 * Stdin reading utility for Claude Code command hooks.
 *
 * @module
 */

//region Stdin reading

/**
 * Reads the full contents of stdin as a string.
 * Uses Bun's streaming API with a `TextDecoder` for incremental chunk decoding.
 *
 * Claude Code command hooks receive their event payload as JSON on stdin.
 * This function collects all chunks until EOF and returns the complete string.
 *
 * @returns Resolved stdin text.
 *
 * @example
 * ```ts
 * import type { StopInput } from '@monochromatic-dev/claude-code-plugins-hook-types'
 *
 * const raw = await readStdin()
 * const event = JSON.parse(raw) as StopInput
 * ```
 */
async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(decoder.decode(chunk, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join('');
}

//endregion

export {
  readStdin,
};
