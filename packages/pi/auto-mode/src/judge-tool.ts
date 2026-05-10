/**
 * Judge tool definition and provider-specific tool choice.
 *
 * Extracted from judge.ts to stay within the line limit.
 *
 * @module
 */

import {
  StringEnum,
  type TSchema,
  type Tool,
} from "@earendil-works/pi-ai";

/** Verdict values for the judge tool. */
const VERDICT_VALUES = [
  "approve",
  "deny",
  "ask",
] as const;

/** Schema for the verdict string enum. */
// oxlint-disable-next-line new-cap -- pi-ai API naming convention
const VerdictEnum = StringEnum(VERDICT_VALUES);

/**
 * Tool definition for the structured-output judge.
 *
 * Uses forced `tool_choice` to guarantee a machine-readable
 * verdict instead of free-text JSON parsing.
 *
 * Shape matches `Tool` from pi-ai: `name`, `description`, `parameters`.
 */
const VERDICT_TOOL: Tool = {
  name: "render_verdict",
  description:
    "Submit your verdict on whether the action should proceed. You MUST call this tool — do not respond with text.",
  parameters: {
    type: "object",
    properties: {
      verdict: {
        description:
          'Your decision: "approve" (safe), "deny" (dangerous), or "ask" (user should decide)',
        ...VerdictEnum,
      },
      reason: {
        type: "string",
        description: "Brief explanation of your reasoning",
      },
      guidance: {
        type: "string",
        description:
          'Actionable guidance for the agent when verdict is "deny" (ignored for approve/ask)',
      },
    },
    required: [
      "verdict",
      "reason",
      "guidance"
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
): Record<string, string> | string {
  if (api === "anthropic-messages") {
    return {
      type: "tool",
      name: "render_verdict",
    };
  }
  if (
    api === "openai-completions" ||
    api === "openai-responses" ||
    api === "azure-openai-responses" ||
    api === "openai-codex-responses"
  ) {
    return "required";
  }
  return "any";
}

export {
  VERDICT_TOOL,
  VERDICT_VALUES,
  toolChoiceForApi,
};
