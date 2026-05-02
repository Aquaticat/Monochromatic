import type {
  UserPromptSubmitInput,
  UserPromptSubmitOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';

/**
 * Pads a non-negative integer to two digits with a leading zero.
 *
 * @param n - integer in `[0, 99]`
 *
 * @returns two-character zero-padded decimal string
 *
 * @example
 * ```ts
 * pad2(7);  // "07"
 * pad2(20); // "20"
 * ```
 */
function pad2(n: number,): string {
  return n.toString().padStart(2, '0',);
}

/**
 * Formats a `Date` as the additionalContext payload `<time>HH:MM</time>` in
 * the system's local 24-hour clock.
 *
 * Pure function -- separated from {@link promptTimeHandler} so unit tests can
 * pin a fixed `Date` and assert on the exact tag.
 *
 * @param now - timestamp to format
 *
 * @returns `<time>HH:MM</time>` literal with zero-padded hour and minute
 *
 * @example
 * ```ts
 * formatTimeContext(new Date('2026-05-01T20:48:00'));
 * // "<time>20:48</time>"
 * ```
 */
function formatTimeContext(now: Date,): string {
  return `<time>${pad2(now.getHours(),)}:${pad2(now.getMinutes(),)}</time>`;
}

/**
 * Output of the prompt-time handler.
 *
 * Always populates `hookSpecificOutput.additionalContext` -- the handler never
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
function promptTimeHandler(_event: UserPromptSubmitInput,): PromptTimeOutput {
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
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 */
/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
function promptTimeParser(raw: string,): UserPromptSubmitInput {
  return JSON.parse(raw,) as UserPromptSubmitInput;
}

/**
 * Serializes the prompt-time output for stdout.
 *
 * No trailing newline -- matches Claude Code's wire convention.
 */
function promptTimeWriter(output: PromptTimeOutput,): string {
  return JSON.stringify(output,);
}

export type { PromptTimeOutput, };

export {
  formatTimeContext,
  promptTimeHandler,
  promptTimeParser,
  promptTimeWriter,
};
