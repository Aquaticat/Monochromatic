/**
 * `render_verdict` tool definition plus provider-specific
 * `tool_choice` mapping.
 *
 * The schema and the toolChoice helper are tested standalone in
 * `judge.unit.test.ts`, so they live separately from the streaming
 * machinery in `judge.ts` (which wires the model call together).
 *
 * @module
 */

import {
  StringEnum,
  type Tool,
  type TSchema,
} from '@earendil-works/pi-ai';
import { toolChoiceForApi as sharedToolChoiceForApi, } from '@monochromatic-dev/pi-shared-model-review/ts';

/**
 * Verdict values for the judge tool.
 */
const VERDICT_VALUES = [
  'approve',
  'deny',
  'ask',
] as const;

/**
 * Schema for the verdict string enum.
 */
const VerdictEnum = StringEnum(VERDICT_VALUES,);

/**
 * Tool definition for the structured-output judge.
 *
 * Uses forced `tool_choice` to guarantee a machine-readable
 * verdict instead of free-text JSON parsing.
 *
 * Shape matches {@link Tool} from pi-ai: `name`, `description`, `parameters`.
 */
const VERDICT_TOOL: Tool = {
  name: 'render_verdict',
  description:
    'Submit your verdict on whether the action should proceed. You MUST call this tool; do not respond with text.',
  parameters: {
    type: 'object',
    properties: {
      verdict: {
        description:
          'Your decision: "approve" (safe), "deny" (dangerous), or "ask" (user should decide)',
        ...VerdictEnum,
      },
      reason: {
        type: 'string',
        description:
          'Brief explanation of your reasoning; keep it safe to show to the coding agent when blocked',
      },
      guidance: {
        type: 'string',
        description:
          'Actionable guidance for the agent when verdict is "deny"; sent with reason when blocked',
      },
    },
    required: [
      'verdict',
      'reason',
      'guidance',
    ],
  } as TSchema,
};

/**
 * Get the tool_choice value for a given model API.
 *
 * API-specific tool choice values:
 * - Anthropic messages: `{ type: "tool", name }` (forced tool call)
 * - OpenAI completions / responses: `"required"` (forced tool call)
 * - Others: `"any"` (allow any tool call)
 *
 * @param api - the model API identifier (from `model.api`)
 *
 * @returns the API-specific tool_choice value
 *
 * @example
 * ```typescript
 * toolChoiceForApi("anthropic-messages"); // { type: "tool", name: "render_verdict" }
 * toolChoiceForApi("openai-completions"); // "required"
 * toolChoiceForApi("google-generative-ai"); // "any"
 * ```
 */
function toolChoiceForApi(
  api: string,
): Readonly<Record<string, string>> | string {
  return sharedToolChoiceForApi({
    api,
    toolName: VERDICT_TOOL.name,
  },);
}

export {
  toolChoiceForApi,
  VERDICT_TOOL,
  VERDICT_VALUES,
};
