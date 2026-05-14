import type {
  UserPromptSubmitInput,
  UserPromptSubmitOutput,
} from '@monochromatic-dev/claude-code-plugins-hook-types';

//region Patterns

/**
 * Phrases that indicate the user is correcting a substantive claim from the
 * previous assistant response.
 *
 * Drawn from session evidence (`1cbe8d82`) where four consecutive user
 * corrections produced four fresh errors: each revision shared the blind
 * spot of the claim it replaced. The pattern this hook targets is treating
 * a correction as a small patch rather than an approach-change moment that
 * warrants calling `advisor`.
 */
const CORRECTION_PATTERNS: readonly RegExp[] = [
  /\bdemonstrably (?:false|wrong)\b/i,
  /\byou missed\b/i,
  /\bdidn['']?t you\b/i,
  /\byou['']?re wrong\b/i,
  /\byou are wrong\b/i,
  /\bshouldn['']?t have\b/i,
  /\bshould not have\b/i,
  /\bwhy would you\b/i,
  /\bthat['']?s wrong\b/i,
  /\bthis is wrong\b/i,
  /\byou got (?:that|this|it) wrong\b/i,
  /\byou['']?re not (?:feeling|paying) (?:well|attention)\b/i,
  /\bplease be more careful\b/i,
  /\b(?:are you|aren['']?t you) (?:not )?paying attention\b/i,
];

//endregion

//region Detection

/**
 * Tests whether a user prompt matches any correction-phrase pattern.
 *
 * @param prompt - raw user input from the UserPromptSubmit event
 *
 * @returns `true` when the prompt looks like a correction of a prior claim
 *
 * @example
 * ```ts
 * detectCorrection('That\'s demonstrably false. Please be more careful.');
 * // => true
 *
 * detectCorrection('What\'s the status of the build?');
 * // => false
 * ```
 */
function detectCorrection(prompt: string,): boolean {
  for (const pattern of CORRECTION_PATTERNS) {
    if (pattern.test(prompt,))
      return true;
  }
  return false;
}

//endregion

//region Output

/**
 * Text injected into Claude's context when a correction is detected.
 *
 * Mirrors the language of AGENTS.md Pre-response checklist item 11 so the
 * reminder fires in the same vocabulary the agent is already trained on.
 */
const CORRECTION_REMINDER_TEXT = [
  '<correction-detected>',
  'The user is correcting a substantive claim from your previous response.',
  'Per AGENTS.md Pre-response checklist item 11: a user correction is an',
  'approach-change moment, not a small patch. The blind spot that produced',
  'the original claim is still active for the revision.',
  '',
  'Before your next substantive response, call the advisor tool.',
  'It receives your full transcript, so it can see the blind spot you cannot.',
  '</correction-detected>',
].join('\n',);

/**
 * Output of the correction-reminder handler.
 *
 * Always uses `additionalContext` -- the handler never blocks the prompt.
 */
type CorrectionReminderOutput = UserPromptSubmitOutput;

//endregion

/**
 * Scans user input for correction phrases and injects an advisor-call
 * reminder when one is found. Returns an empty additionalContext when no
 * correction is detected so the rest of the pipeline runs unchanged.
 *
 * @param event - parsed UserPromptSubmit event from Claude Code
 *
 * @returns UserPromptSubmit response with `additionalContext` populated when
 *   a correction phrase fires, empty string otherwise
 *
 * @example
 * ```ts
 * correctionReminderHandler({
 *   hook_event_name: 'UserPromptSubmit',
 *   prompt: 'That\'s demonstrably false.',
 *   session_id: 's', transcript_path: '/t', cwd: '/c',
 * });
 * // additionalContext contains the <correction-detected> reminder
 * ```
 */
function correctionReminderHandler(
  event: UserPromptSubmitInput,
): CorrectionReminderOutput {
  const triggered = detectCorrection(event.prompt,);
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: triggered ? CORRECTION_REMINDER_TEXT : '',
    },
  };
}

/**
 * Parses raw stdin as a `UserPromptSubmitInput`.
 *
 * Input is trusted -- it comes from Claude Code's hook dispatch system.
 *
 * @param raw - JSON-encoded event payload received on stdin
 *
 * @returns the parsed UserPromptSubmit event
 *
 * @example
 * ```ts
 * correctionReminderParser('{"hook_event_name":"UserPromptSubmit","prompt":"hi"}');
 * // => { hook_event_name: 'UserPromptSubmit', prompt: 'hi', ... }
 * ```
 */
function correctionReminderParser(raw: string,): UserPromptSubmitInput {
  /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
  return JSON.parse(raw,) as UserPromptSubmitInput;
}

/**
 * Serializes the correction-reminder output for stdout.
 *
 * No trailing newline -- matches Claude Code's wire convention.
 *
 * @param output - handler result to serialize
 *
 * @returns JSON-encoded payload for Claude Code's hook reader
 *
 * @example
 * ```ts
 * correctionReminderWriter({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: '' } });
 * // => '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":""}}'
 * ```
 */
function correctionReminderWriter(output: CorrectionReminderOutput,): string {
  return JSON.stringify(output,);
}

export type { CorrectionReminderOutput, };

export {
  correctionReminderHandler,
  correctionReminderParser,
  correctionReminderWriter,
  detectCorrection,
};
