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

import type {
  AssistantMessageEvent,
  ToolCall,
} from "@earendil-works/pi-ai";
import type { Verdict, } from "./types.ts";

//region Stream collection

/**
 * Collect tool call arguments from a model stream.
 *
 * Uses the pi-ai event protocol: `toolcall_end` carries the complete
 * `ToolCall` with parsed `name` and `arguments`.
 *
 * Falls back to parsing text content if no tool call was emitted
 * (some providers or model configs may ignore `toolChoice` and
 * return free-text JSON instead). The fallback path logs to stderr
 * so an operator can see the contract violation.
 *
 * pi-ai's `text_end.content` is the cumulative text for one content
 * block, not a delta. With multiple text blocks, contents are
 * concatenated; `text_delta` events are ignored to avoid
 * double-counting.
 *
 * @param stream - model event stream
 *
 * @returns parsed tool call arguments object
 *
 * @throws when the stream produces neither a `render_verdict` tool
 *   call nor parseable text content
 *
 * @example
 * ```typescript
 * const args = await collectToolCall(stream);
 * // args = { verdict: "approve", reason: "safe", guidance: "" }
 * ```
 */
async function collectToolCall(
  stream: AsyncIterable<AssistantMessageEvent>,
): Promise<Record<string, string>> {
  let toolCall: ToolCall | undefined = undefined;
  let textContent = "";

  for await (const event of stream) {
    if (event.type === "toolcall_end") {
      ({ toolCall, } = event);
    }

    if (event.type === "text_end") {
      textContent += event.content;
    }
  }

  if (toolCall !== undefined) {
    if (toolCall.name !== "render_verdict") {
      throw new Error(
        `Judge called unexpected tool: "${toolCall.name}" instead of "render_verdict"`,
      );
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ToolCall.arguments is `unknown` from pi-ai; the schema enforces shape
    return toolCall.arguments as Record<string, string>;
  }

  if (textContent !== "") {
    console.error(
      'auto-mode judge: text-fallback fired (model returned text instead of calling render_verdict tool); '
      + 'this indicates the provider ignored toolChoice',
    );
    return extractJsonVerdict(textContent);
  }

  throw new Error(
    'Judge did not call any tool (expected "render_verdict")',
  );
}
//endregion

//region Text fallback

/** Maximum characters of judge text to include in error messages. */
const JUDGE_TEXT_ERROR_LIMIT = 200;

/**
 * Extract a JSON verdict from free-text model output.
 *
 * Tries `JSON.parse(text)` first, then falls back to scanning for the
 * first balanced `{...}` block. Balanced scanning ignores braces inside
 * string literals (so a `"reason"` field containing `{` does not skew
 * the boundaries).
 *
 * @param text - model's text output
 *
 * @returns parsed verdict arguments
 *
 * @throws when no parseable JSON object is found in the text
 *
 * @example
 * ```typescript
 * extractJsonVerdict('{"verdict":"approve"}'); // { verdict: "approve" }
 * extractJsonVerdict('preface {"verdict":"deny"} suffix'); // { verdict: "deny" }
 * ```
 */
function extractJsonVerdict(
  text: string,
): Record<string, string> {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown
    return JSON.parse(text,) as Record<string, string>;
  }
  catch {
    /* Fall through to balanced-brace scan. */
  }

  const block = findBalancedJsonObject(text,);
  if (block === undefined) {
    throw new Error(
      `Judge returned text without JSON verdict: ${text.slice(
        0,
        JUDGE_TEXT_ERROR_LIMIT,
      )}`,
    );
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown
  return JSON.parse(block,) as Record<string, string>;
}

/**
 * Find the first balanced `{...}` block in a string, ignoring braces
 * inside string literals.
 *
 * Tracks string state and escapes so a `"text with } inside"` field
 * does not terminate the scan early.
 *
 * @param text - string to scan
 *
 * @returns the matched block including delimiters, or `undefined` when no
 *   balanced object is found
 */
function findBalancedJsonObject(text: string,): string | undefined {
  const start = text.indexOf("{",);
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escape = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(
          start,
          i + 1,
        );
      }
    }
  }
  return undefined;
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
  extractJsonVerdict,
  parseVerdict,
};
