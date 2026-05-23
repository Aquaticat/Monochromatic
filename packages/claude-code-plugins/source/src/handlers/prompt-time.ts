import type {
  UserPromptSubmitInput,
  UserPromptSubmitOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import type { ReadonlyDeep, } from 'type-fest';

import { formatTimeContext, } from '@monochromatic-dev/module-current-time-context';
import { parseHookJson, } from '../runtime/handler-runtime.ts';

/**
 * Output of the prompt-time handler.
 *
 * Always populates `hookSpecificOutput.additionalContext`: the handler never
 * blocks the prompt or chooses an empty response.
 */
type PromptTimeOutput = UserPromptSubmitOutput;

/**
 * Injects the current local system time into Claude's conversation context
 * each time the user submits a prompt.
 *
 * Reads the wall clock at handler-call time; non-deterministic by design.
 * The pure {@link formatTimeContext} helper is what unit tests target.
 *
 * @param _event - parsed UserPromptSubmit event from Claude Code (unused; the
 *   handler does not inspect the prompt text)
 *
 * @returns response carrying `<time>HH:MM</time>` as `additionalContext`
 *
 * @example
 * ```ts
 * promptTimeHandler({
 *   hook_event_name: 'UserPromptSubmit',
 *   prompt: 'hello',
 *   session_id: 's',
 *   transcript_path: '/t',
 *   cwd: '/c',
 * });
 * // { hookSpecificOutput: { hookEventName: 'UserPromptSubmit',
 * //                         additionalContext: '<time>20:48</time>' } }
 * ```
 */
function promptTimeHandler(_event: ReadonlyDeep<UserPromptSubmitInput>,): PromptTimeOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: formatTimeContext(new Date(),),
    },
  };
}

/**
 * Parses raw stdin as a `UserPromptSubmitInput`.
 *
 * Input is trusted; it comes from Claude Code's hook dispatch system.
 *
 * @param raw - JSON payload from Claude Code stdin
 *
 * @returns parsed UserPromptSubmit event
 *
 * @example
 * ```ts
 * const event = promptTimeParser(await text(process.stdin));
 * ```
 */
function promptTimeParser(raw: string,): UserPromptSubmitInput {
  return parseHookJson<UserPromptSubmitInput>(raw,);
}

/**
 * Serializes the prompt-time output for stdout.
 *
 * No trailing newline; matches Claude Code's wire convention.
 *
 * @param output - handler result to serialize
 *
 * @returns JSON string for stdout
 *
 * @example
 * ```ts
 * process.stdout.write(promptTimeWriter(output));
 * ```
 */
function promptTimeWriter(output: ReadonlyDeep<PromptTimeOutput>,): string {
  return JSON.stringify(output,);
}

export type { PromptTimeOutput, };

export {
  formatTimeContext,
  promptTimeHandler,
  promptTimeParser,
  promptTimeWriter,
};
