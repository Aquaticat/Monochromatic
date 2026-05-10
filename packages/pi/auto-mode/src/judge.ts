/**
 * LLM-as-judge for tool call evaluation.
 *
 * Calls a budget model with forced tool-calling to get
 * a structured approve/deny/ask verdict.
 *
 * @module
 */

import {
  streamSimple,
  type Api,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import type {
  BatchEntry,
  BudgetModelAuth,
  Verdict,
} from "./types.ts";
import {
  VERDICT_TOOL,
  toolChoiceForProvider,
} from "./judge-tool.ts";

//region Public API

/**
 * Call the judge model and return a structured verdict.
 *
 * Uses forced `tool_choice` to guarantee a machine-readable
 * response from the render_verdict tool.
 *
 * @param model - the budget model to call
 *
 * @param _auth - unused auth (model registry handles auth)
 *
 * @param action - description of the action being evaluated
 *
 * @param cwd - the agent's working directory
 *
 * @param recentContext - recent session activity summary
 *
 * @param trustDirectives - active user trust directives
 *
 * @param timeoutMs - maximum time to wait for a response
 *
 * @param systemPrompt - the judge system prompt
 *
 * @param batchContext - other tool calls in the same batch
 *
 * @returns the judge's verdict
 *
 * @example
 * ```typescript
 * const verdict = await callJudge(model, auth, "bash: sudo rm -rf /", "/project", context, [], 10_000, prompt);
 * ```
 */
async function callJudge(
  model: Model<Api>,
  _auth: BudgetModelAuth,
  action: string,
  cwd: string,
  recentContext: string,
  trustDirectives: string[],
  timeoutMs: number,
  systemPrompt: string,
  batchContext: BatchEntry[] | undefined,
): Promise<Verdict> {
  const userContent = buildUserContent(
    action,
    cwd,
    recentContext,
    trustDirectives,
    batchContext,
  );

  const messages = [
    {
      role: "user" as const,
      content: userContent,
      timestamp: Date.now(),
    },
  ];

  const controller = new AbortController();
  using _timer = disposableTimeout(
    timeoutMs,
    function onTimeout() { controller.abort(); },
  );

  const opts: Record<string, unknown> = {
    signal: controller.signal,
  };
  if (_auth.apiKey !== undefined) {
    opts.apiKey = _auth.apiKey;
  }
  if (_auth.headers !== undefined) {
    opts.headers = _auth.headers;
  }
  opts.toolChoice = toolChoiceForProvider(String(model.provider));

  const stream = streamSimple(
    model,
    {
      systemPrompt,
      messages,
      tools: [VERDICT_TOOL],
    },
    opts as SimpleStreamOptions,
  );

  const result = await collectToolCall(stream);
  return parseVerdict(result);
}

//endregion

//region Message building

/**
 * Build the user content message for the judge.
 *
 * @param action - description of the action
 *
 * @param cwd - the working directory
 *
 * @param recentContext - recent session activity
 *
 * @param trustDirectives - active trust directives
 *
 * @param batchContext - other tool calls in the same batch
 *
 * @returns formatted user message content
 */
function buildUserContent(
  action: string,
  cwd: string,
  recentContext: string,
  trustDirectives: string[],
  batchContext: BatchEntry[] | undefined,
): string {
  const lines: string[] = [
    `Working directory: ${cwd}`,
    "",
    `Action: ${action}`,
  ];

  if (trustDirectives.length > 0) {
    lines.push(
      "",
      "User trust directives for this session:",
    );
    for (const directive of trustDirectives) {
      lines.push(`  - ${directive}`);
    }
  }

  if (recentContext !== "") {
    lines.push(
      "",
      "Recent activity:",
      recentContext,
    );
  }

  if (batchContext !== undefined && batchContext.length > 0) {
    lines.push(
      "",
      "Other actions in this batch:",
    );
    for (const entry of batchContext) {
      lines.push(`  - ${entry.action} → ${entry.verdict}`);
    }
  }

  return lines.join("\n");
}

//endregion

//region Stream collection

/* oxlint-disable typescript/no-unsafe-type-assertion -- untyped stream events require assertions */
/**
 * Collect tool call arguments from a model stream.
 *
 * @param stream - the model event stream
 *
 * @returns the parsed tool call arguments object
 */
async function collectToolCall(
  stream: AsyncIterable<unknown>,
): Promise<Record<string, string>> {
  let fnName = "";
  let argsStr = "";

  for await (const event of stream) {
    const evt = event as Record<string, unknown>;
    const type = evt.type as string | undefined;

    if (type === "content_block_start") {
      const contentBlock = evt.contentBlock as Record<string, unknown> | undefined;
      if (contentBlock !== undefined) {
        fnName = (contentBlock.name as string | undefined) ?? "";
      }
    }

    if (type === "content_block_delta") {
      const delta = evt.delta as Record<string, unknown> | undefined;
      if (delta !== undefined) {
        argsStr += (delta.partialJson as string | undefined) ?? (delta.text as string | undefined) ?? "";
      }
    }
  }

  if (fnName !== "render_verdict") {
    throw new Error(
      `Judge called unexpected tool: "${fnName}" instead of "render_verdict"`,
    );
  }

  return JSON.parse(argsStr) as Record<string, string>;
}
/* oxlint-enable typescript/no-unsafe-type-assertion */
//endregion

//region Verdict parsing

/**
 * Parse raw tool call arguments into a Verdict.
 *
 * @param args - the raw tool call arguments
 *
 * @returns a structured verdict
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

//region Disposable helpers

/**
 * Create a disposable timeout that clears itself on scope exit.
 *
 * @param ms - timeout duration in milliseconds
 *
 * @param onTimeout - callback when the timeout fires
 *
 * @returns a disposable object
 */
function disposableTimeout(
  ms: number,
  onTimeout: () => void,
): Disposable {
  const id = setTimeout(
    onTimeout,
    ms
  );
  return {
    [Symbol.dispose]() { clearTimeout(id); },
  };
}

//endregion

export { callJudge, };
