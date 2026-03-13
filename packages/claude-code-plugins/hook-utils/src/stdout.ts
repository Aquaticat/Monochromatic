/**
 * Stdout writing utility for Claude Code command hooks.
 *
 * @module
 */

import type {
  HookOutputBase,
} from '@monochromatic-dev/claude-code-plugins-hook-types';

//region Stdout writing

/**
 * Writes a hook output object as JSON to stdout.
 *
 * Claude Code command hooks communicate their decisions by writing
 * a JSON object to stdout before exiting. This function handles
 * the serialization and write in one call.
 *
 * @param output - Hook output object conforming to `HookOutputBase` or a subtype.
 *
 * @example
 * ```ts
 * import type { StopOutput } from '\@monochromatic-dev/claude-code-plugins-hook-types'
 *
 * const output: StopOutput = { decision: 'block', reason: 'Needs investigation' }
 * writeOutput(output)
 * ```
 */
function writeOutput(output: HookOutputBase): void {
  process.stdout.write(JSON.stringify(output));
}

//endregion

export {
  writeOutput,
};
