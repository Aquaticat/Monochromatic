/**
 * Stream collection and verdict parsing for the judge.
 *
 * Extracted from judge.ts to stay within the line limit.
 * Handles collecting tool calls from the model stream,
 * falling back to text parsing if tool_choice is ignored,
 * and converting raw arguments into a Verdict.
 *
 * @module
 */

import type { Verdict, } from "./types.ts";

//region Stream collection

/* oxlint-disable typescript/no-unsafe-type-assertion -- untyped stream events require assertions */
/**
 * Collect tool call arguments from a model stream.
 *
 * Uses the pi-ai event protocol: `toolcall_start`/`toolcall_delta`/`toolcall_end`.
 * The final `toolcall_end` event carries the complete `ToolCall` with
 * parsed `name` and `arguments`.
 *
 * Falls back to parsing text content if no tool call was emitted
 * (some providers or model configs may ignore `toolChoice` and
 * return free-text JSON instead).
 *
 * @param stream - the model event stream
 *
 * @returns the parsed tool call arguments object
 *
 * @example
 * ```typescript
 * const args = await collectToolCall(stream);
 * // args = { verdict: "approve", reason: "safe", guidance: "" }
 * ```
 */
async function collectToolCall(
  stream: AsyncIterable<unknown>,
): Promise<Record<string, string>> {
  let toolCall: Record<string, unknown> | undefined = undefined;
  let textContent = "";

  for await (const event of stream) {
    const evt = event as Record<string, unknown>;
    const type = evt.type as string | undefined;

    if (type === "toolcall_end") {
      toolCall = evt.toolCall as Record<string, unknown> | undefined;
    }

    if (type === "text_delta") {
      const delta = evt.delta as string | undefined;
      if (delta !== undefined) textContent += delta;
    }

    if (type === "text_end") {
      const content = evt.content as string | undefined;
      if (content !== undefined) textContent = content;
    }
  }

  if (toolCall !== undefined) {
    const fnName = (toolCall.name as string | undefined) ?? "";
    if (fnName !== "render_verdict") {
      throw new Error(
        `Judge called unexpected tool: "${fnName}" instead of "render_verdict"`,
      );
    }
    return toolCall.arguments as Record<string, string>;
  }

  // Fallback: model returned text instead of a tool call.
  // Try to extract a JSON verdict from the text content.
  if (textContent !== "") {
    return extractJsonVerdict(textContent);
  }

  throw new Error(
    'Judge did not call any tool (expected "render_verdict")',
  );
}
/* oxlint-enable typescript/no-unsafe-type-assertion */
//endregion

//region Text fallback

/** Maximum characters of judge text to include in error messages. */
const JUDGE_TEXT_ERROR_LIMIT = 200;

/**
 * Extract a JSON verdict from free-text model output.
 *
 * Searches for the first `{...}` block and parses it as
 * verdict arguments. This fallback handles models that
 * ignore `toolChoice` and respond with text instead.
 *
 * @param text - the model's text output
 *
 * @returns parsed verdict arguments
 */
function extractJsonVerdict(
  text: string,
): Record<string, string> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(
      `Judge returned text without JSON verdict: ${text.slice(
        0,
        JUDGE_TEXT_ERROR_LIMIT,
      )}`,
    );
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown
  return JSON.parse(text.slice(
    start,
    end + 1,
  )) as Record<string, string>;
}

//endregion

//region Verdict parsing

/**
 * Parse raw tool call arguments into a Verdict.
 *
 * @param args - the raw tool call arguments
 *
 * @returns a structured verdict
 *
 * @example
 * ```typescript
 * parseVerdict({ verdict: "deny", reason: "dangerous", guidance: "Use propose_trust" });
 * // => { verdict: "deny", reason: "dangerous", guidance: "Use propose_trust" }
 * ```
 */
function parseVerdict(
  args: Record<string, string>,
): Verdict {
  const verdict = args.verdict ?? "ask";
  const reason = args.reason ?? "";
  const guidance = args.guidance ?? "";

  if (
    verdict !== "approve" &&
    verdict !== "deny" &&
    verdict !== "ask"
  ) {
    return {
      verdict: "ask",
      reason: `Judge returned unexpected verdict: "${verdict}". ${reason}`,
      guidance: "",
    };
  }

  return {
    verdict,
    reason,
    guidance,
  };
}

//endregion

export {
  collectToolCall,
  parseVerdict,
};
