/**
 * Stdin reading utility for Claude Code command hooks.
 *
 * @module
 */

import { text } from 'node:stream/consumers';

//region Stdin reading

/**
 * Reads the full contents of stdin as a string.
 * Uses `node:stream/consumers` for cross-runtime compatibility (Node 16.7+, Bun, Deno).
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
  return text(process.stdin);
}

//endregion

export {
  readStdin,
};
