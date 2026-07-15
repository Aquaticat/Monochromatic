/**
 * Bash command analysis wrapper for auto-mode.
 *
 * Delegates to shared `unbash`-backed shell command analyzer while preserving
 * the auto-mode-local function name used by existing signal code and tests.
 *
 * @module
 */

import { analyzeShellCommand, } from '@monochromatic-dev/agent-harness-shared-shell-command-analyzer/ts';
import type { BashAnalysis, } from './types.ts';

/**
 * Parse Bash command and extract structured signals.
 *
 * @param command - raw bash command string
 *
 * @returns structured analysis of command
 *
 * @example
 * ```typescript
 * analyzeBashCommand('curl $API_KEY | jq .name > out.txt');
 * ```
 */
function analyzeBashCommand(command: string,): BashAnalysis {
  return analyzeShellCommand(command,);
}

export { analyzeBashCommand, };
