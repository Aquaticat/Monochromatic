/**
 * Shared utilities for Claude Code hook plugins.
 *
 * Provides common I/O operations used across all command-type hooks:
 * reading JSON input from stdin and writing JSON output to stdout.
 *
 * @example
 * ```ts
 * import { readStdin, writeOutput } from '@monochromatic-dev/claude-code-plugins-hook-utils'
 * import type { StopInput, StopOutput } from '@monochromatic-dev/claude-code-plugins-hook-types'
 *
 * const event = JSON.parse(await readStdin()) as StopInput
 * const output: StopOutput = { decision: 'block', reason: 'Needs investigation' }
 * writeOutput(output)
 * ```
 *
 * @module
 */

export { readStdin, } from './stdin.ts';

export { writeOutput, } from './stdout.ts';
