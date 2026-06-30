/**
 * Model-facing feedback formatting for blocked auto-mode decisions.
 *
 * Keeps judge rationale and actionable guidance together in the
 * blocked tool result that the main model receives.
 *
 * @module
 */

import { DEFAULT_DENY_GUIDANCE, } from './system-prompt.ts';

/**
 * Fallback rationale used when a judge or guardrail branch omits a reason.
 */
const MISSING_GUARDRAIL_REASON = 'No guardrail reason was provided.';

/**
 * Build a blocked-tool reason visible to the main model.
 *
 * Falls back to {@link MISSING_GUARDRAIL_REASON} when the rationale is empty.
 *
 * @param guardrailReason - preserves rationale needed for agent self-correction
 *
 * @param guidance - preserves safer next step when judge provided one;
 *   defaults to {@link DEFAULT_DENY_GUIDANCE}
 *
 * @returns model-facing text so blocked tool results contain rationale and next step
 *
 * @example
 * ```typescript
 * formatModelBlockReason({
 *   guardrailReason: 'This would expose secrets.',
 *   guidance: 'Ask the user to provide the value directly.',
 * });
 * ```
 */
function formatModelBlockReason(
  {
    guardrailReason,
    guidance = DEFAULT_DENY_GUIDANCE,
  }: {
    readonly guardrailReason: string;
    readonly guidance?: string;
  },
): string {
  /**
   * Guardrail rationale after trimming whitespace from model or UI input.
   */
  const normalizedReason = guardrailReason.trim();
  /**
   * Actionable next step after trimming whitespace from model input.
   */
  const normalizedGuidance = guidance.trim();

  return [
    `Guardrail reason: ${
      normalizedReason !== ''
        ? normalizedReason
        : MISSING_GUARDRAIL_REASON
    }`,
    `Guidance: ${
      normalizedGuidance !== ''
        ? normalizedGuidance
        : DEFAULT_DENY_GUIDANCE
    }`,
  ].join('\n\n',);
}

export { formatModelBlockReason, };
