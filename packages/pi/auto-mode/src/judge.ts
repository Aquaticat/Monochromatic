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
  toolChoiceForApi,
} from "./judge-tool.ts";
import {
  collectToolCall,
  parseVerdict,
} from "./judge-stream.ts";

//region Public API

/**
 * Call the judge model and return a structured verdict.
 *
 * Uses forced `tool_choice` to guarantee a machine-readable
 * response from the render_verdict tool.
 *
 * @param model - budget model to call
 *
 * @param auth - optional API key and headers forwarded to the stream
 *   when set; the model registry already handles auth, so most callers
 *   leave these undefined
 *
 * @param action - description of the action being evaluated
 *
 * @param cwd - agent's working directory
 *
 * @param recentContext - recent session activity summary
 *
 * @param trustDirectives - active user trust directives
 *
 * @param timeoutMs - maximum time to wait for a response
 *
 * @param systemPrompt - judge system prompt
 *
 * @param batchContext - other tool calls in the same batch
 *
 * @returns judge's verdict
 *
 * @example
 * ```typescript
 * const verdict = await callJudge(model, auth, "bash: sudo rm -rf /", "/project", context, [], 10_000, prompt);
 * ```
 */
async function callJudge(
  model: Model<Api>,
  auth: BudgetModelAuth,
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
  if (auth.apiKey !== undefined) {
    opts.apiKey = auth.apiKey;
  }
  if (auth.headers !== undefined) {
    opts.headers = auth.headers;
  }
  opts.toolChoice = toolChoiceForApi(String(model.api));

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
