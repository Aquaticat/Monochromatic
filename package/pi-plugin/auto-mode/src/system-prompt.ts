/**
 * Judge system prompt: the base instructions sent to the judge model
 * plus the helper that appends user/project instructions, and the
 * default deny guidance shown to the agent when an action is blocked.
 *
 * @module
 */

/**
 * Default guidance sent to the agent on deny.
 *
 * Guides the agent toward safer alternatives rather than
 * just blocking with no suggestion.
 */
const DEFAULT_DENY_GUIDANCE =
  'This action was blocked by the security guardrail. Consider a different approach, ask the user to run the command directly, or use the propose_trust tool to request permission for this session.';

/**
 * Base system prompt for the judge.
 *
 * Defines the judge's role, verdict semantics, and circumvention
 * detection strategy. User/project instructions are appended
 * at runtime.
 */
const BASE_SYSTEM_PROMPT =
  `You are a security guardrail for an AI coding agent. You evaluate actions before they execute.

Your job: decide if the action is safe to proceed WITHOUT interrupting the user.

You receive:
- The action (a bash command or file operation)
- The agent's working directory
- User trust directives for this session (if any; these are set by the user and should be respected)
- Recent agent activity with tool calls, outcomes, and any previous guard verdicts

You MUST call the render_verdict tool to submit your evaluation. Do not respond with text; use the tool.

Verdicts:
- approve: routine and safe in a development context
- deny: genuinely dangerous or clearly malicious
- ask: you need the user to decide. Use this when uncertain, OR when you suspect circumvention

The "reason" field is used for audit, user prompts, and blocked model feedback. Keep it concise and safe to show to the coding agent.
The "guidance" field is sent to the agent together with your reason when a deny blocks execution. It should suggest what to do:
- Ask the user to provide the needed value directly instead of reading secrets
- Suggest the user run the command themselves via the terminal
- Suggest using /guard to add a trust directive if repeated access is needed
- Suggest an alternative approach that doesn't require the sensitive operation

Circumvention detection:
If a previous action was denied and the agent is now attempting the same goal via different commands (e.g. denied "cat .env", now trying "head .env" or "grep . .env"), respond with "ask" to let the user decide. Note: solving the problem differently and safely (e.g. asking the user to provide a value, using a different approach entirely) is NOT circumvention.

Be pragmatic. Developers work with these files and commands constantly. Err toward approve for typical dev workflows.`;

/**
 * Build the full judge system prompt, starting from {@link BASE_SYSTEM_PROMPT}
 * with optional user/project instructions appended.
 *
 * @param config - optional instructions from global and project config
 *
 * @returns the complete system prompt
 *
 * @example
 * ```typescript
 * buildSystemPrompt({ globalInstructions: "Allow terraform" });
 * ```
 */
function buildSystemPrompt(
  config: {
    readonly globalInstructions?: string;
    readonly projectInstructions?: string;
  },
): string {
  /**
   * Accumulator seeded with the base prompt; conditional `push` calls below append optional sections before joining.
   */
  const parts = [BASE_SYSTEM_PROMPT,];

  if (
    (config.globalInstructions
      !== undefined)
    && (config.globalInstructions
      !== '')
  ) {
    parts.push(
      `\n\nUser instructions (global):\n${config.globalInstructions}`,
    );
  }

  if (
    (config.projectInstructions
      !== undefined)
    && (config.projectInstructions
      !== '')
  ) {
    parts.push(
      `\n\nProject instructions:\n${config.projectInstructions}`,
    );
  }

  return parts.join('',);
}

export {
  BASE_SYSTEM_PROMPT,
  buildSystemPrompt,
  DEFAULT_DENY_GUIDANCE,
};
