/**
 * LLM-as-judge for tool call evaluation.
 *
 * Calls a budget model with forced tool-calling, collects the
 * resulting `render_verdict` tool call (or falls back to parsing
 * free-text JSON when a provider ignores `toolChoice`), and
 * converts the raw arguments into a structured Verdict.
 *
 * @module
 */

import {
  type Api,
  type AssistantMessageEvent,
  type Model,
  type SimpleStreamOptions,
  streamSimple,
  type ToolCall,
} from '@earendil-works/pi-ai';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import {
  toolChoiceForApi,
  VERDICT_TOOL,
} from './judge-tool.ts';
import { l as parentLogger, } from './log.ts';
import type {
  BatchEntry,
  BudgetModelAuth,
  Verdict,
} from './types.ts';

/** Tagged logger for the judge module. */
const l = tagged({
  tag: 'judge',
  l: parentLogger,
},);

//region Public API

/**
 * Call the judge model and return a structured verdict.
 *
 * Uses forced `tool_choice` to guarantee a machine-readable
 * response from the render_verdict tool.
 *
 * @returns judge's verdict
 *
 * @example
 * ```typescript
 * const verdict = await callJudge({
 *   model,
 *   auth,
 *   action: "bash: sudo rm -rf /",
 *   cwd: "/project",
 *   recentContext: context,
 *   trustDirectives: [],
 *   timeoutMs: 10_000,
 *   systemPrompt: prompt,
 *   batchContext: undefined,
 * });
 * ```
 */
async function callJudge(
  {
    model,
    auth,
    action,
    cwd,
    recentContext,
    trustDirectives,
    timeoutMs,
    systemPrompt,
    batchContext,
  }: {
    model: Model<Api>;
    auth: BudgetModelAuth;
    action: string;
    cwd: string;
    recentContext: string;
    trustDirectives: string[];
    timeoutMs: number;
    systemPrompt: string;
    batchContext: BatchEntry[] | undefined;
  },
): Promise<Verdict> {
  /** Per-call sub-logger so log lines from this entry point carry the function name as a tag. */
  const innerL = tagged({
    tag: callJudge.name,
    l,
  },);
  innerL.debug(`calling ${String(model.provider,)}/${model.id} for action: ${action}`,);

  /** Rendered user-message body that bundles working directory, action, context, and batch siblings. */
  const userContent = buildUserContent({
    action,
    cwd,
    recentContext,
    trustDirectives,
    batchContext,
  },);

  /** Single-turn user message array handed to the streaming entry point. */
  const messages = [
    {
      role: 'user' as const,
      content: userContent,
      timestamp: Date.now(),
    },
  ];

  /** Abort controller wired into both the timeout disposable and the stream's `signal` option. */
  const controller = new AbortController();
  /** Disposable timer; on scope exit it clears the timeout regardless of how the function returns. */
  using _timer = disposableTimeout({
    ms: timeoutMs,
    onTimeout() {
      controller.abort();
    },
  },);

  /** Provider-specific stream options assembled key-by-key so `auth` fields stay optional. */
  const opts: Record<string, unknown> = {
    signal: controller.signal,
  };
  if (auth.apiKey
    !== undefined)
    opts.apiKey = auth.apiKey;
  if (auth.headers
    !== undefined)
    opts.headers = auth.headers;
  opts.toolChoice = toolChoiceForApi(String(model.api,),);

  /** Streaming event source for the judge invocation; collected into a tool call below. */
  const stream = streamSimple(
    model,
    {
      systemPrompt,
      messages,
      tools: [VERDICT_TOOL,],
    },
    opts as SimpleStreamOptions,
  );

  /** Parsed `render_verdict` arguments (or the text-fallback record) from the stream. */
  const result = await collectToolCall(stream,);
  return parseVerdict(result,);
}

//endregion

//region Message building

/**
 * Build the user content message for the judge.
 *
 * @returns formatted user message content
 *
 * @example
 * ```typescript
 * buildUserContent({
 *   action: 'bash: rm -rf node_modules',
 *   cwd: '/project',
 *   recentContext: '',
 *   trustDirectives: [],
 *   batchContext: undefined,
 * });
 * ```
 */
function buildUserContent(
  {
    action,
    cwd,
    recentContext,
    trustDirectives,
    batchContext,
  }: {
    action: string;
    cwd: string;
    recentContext: string;
    trustDirectives: string[];
    batchContext: BatchEntry[] | undefined;
  },
): string {
  /** Per-line accumulator for the rendered prompt body; joined with newlines on return. */
  const lines: string[] = [
    `Working directory: ${cwd}`,
    '',
    `Action: ${action}`,
  ];

  if (trustDirectives.length
    > 0) {
    lines.push(
      '',
      'User trust directives for this session:',
    );
    for (const directive of trustDirectives)
      lines.push(`  - ${directive}`,);
  }

  if (recentContext !== '') {
    lines.push(
      '',
      'Recent activity:',
      recentContext,
    );
  }

  if ((batchContext !== undefined) && (batchContext.length
    > 0)) {
    lines.push(
      '',
      'Other actions in this batch:',
    );
    for (const entry of batchContext)
      lines.push(`  - ${entry.action} -> ${entry.verdict}`,);
  }

  return lines.join('\n',);
}

//endregion

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
  /* oxlint-disable no-restricted-syntax/no-function-root-let -- async-iteration accumulator latches: `toolCall` set on `toolcall_end`, `textContent` appended on each `text_end`; both are read after the loop terminates */
  /** Last-seen tool call from the stream; defined only after a `toolcall_end` event. */
  let toolCall: ToolCall | undefined = undefined;
  /** Cumulative text from `text_end` events, used only when the model never emitted a tool call. */
  let textContent = '';
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  for await (const event of stream) {
    if (event.type
      === 'toolcall_end')
      ({ toolCall, } = event);

    if (event.type
      === 'text_end')
      textContent += event.content;
  }

  if (toolCall !== undefined) {
    if (toolCall.name
      !== 'render_verdict') {
      throw new Error(
        `Judge called unexpected tool: "${toolCall.name}" instead of "render_verdict"`,
      );
    }
    return toolCall.arguments as Record<string, string>;
  }

  if (textContent !== '') {
    /** Per-call sub-logger so the text-fallback warning carries the function name as a tag. */
    const innerL = tagged({
      tag: collectToolCall.name,
      l,
    },);
    innerL.error(
      'text-fallback fired (model returned text instead of calling render_verdict tool); '
        + 'this indicates the provider ignored toolChoice',
    );
    return extractJsonVerdict(textContent,);
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

  /** First balanced `{...}` block found in the free-text output, or undefined if none exists. */
  const block = findBalancedJsonObject(text,);
  if (block === undefined) {
    throw new Error(
      `Judge returned text without JSON verdict: ${
        text.slice(
          0,
          JUDGE_TEXT_ERROR_LIMIT,
        )
      }`,
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
 * @returns matched block including delimiters, or `undefined` when no
 *   balanced object is found
 */
function findBalancedJsonObject(text: string,): string | undefined {
  /** Index of the first `{` in the text; the scan starts here. */
  const start = text.indexOf('{',);
  if (start === (-1))
    return undefined;

  /* oxlint-disable no-restricted-syntax/no-function-root-let -- balanced-brace scanner state machine mutated across the character loop (depth counter, string-mode latch, escape latch) */
  /** Brace nesting depth; the slice is taken when this returns to 0. */
  let depth = 0;
  /** True while the scan is inside a double-quoted string literal so braces are ignored. */
  let inString = false;
  /** True after a backslash inside a string so the next character is treated as literal. */
  let escape = false;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  for (let i = start; i < text
    .length; i++) {
    /** Character at the current scan position, used by the state machine below. */
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\')
        escape = true;
      else if (ch === '"')
        inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{')
      depth++;
    else if (ch === '}') {
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
 * @param args - raw tool call arguments
 *
 * @returns structured verdict
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
  /** Raw verdict string from the tool call; defaulted to `ask` when missing so the union check below decides. */
  const verdict = args.verdict
    ?? 'ask';
  /** Free-text rationale captured from the tool call. */
  const reason = args.reason
    ?? '';
  /** Guidance string to surface back to the agent; empty for approvals. */
  const guidance = args.guidance
    ?? '';

  if (
    (verdict !== 'approve')
    && (verdict !== 'deny')
      && (verdict !== 'ask')
  ) {
    return {
      verdict: 'ask',
      reason: `Judge returned unexpected verdict: "${verdict}". ${reason}`,
      guidance: '',
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
 * @returns disposable object
 *
 * @example
 * ```typescript
 * using timer = disposableTimeout({ ms: 5_000, onTimeout: () => controller.abort() });
 * ```
 */
function disposableTimeout(
  {
    ms,
    onTimeout,
  }: {
    ms: number;
    onTimeout: () => void;
  },
): Disposable {
  /** Timer handle returned by setTimeout; cleared on dispose to cancel pending callbacks. */
  const id = setTimeout(
    onTimeout,
    ms,
  );
  return {
    [Symbol.dispose]() {
      clearTimeout(id,);
    },
  };
}

//endregion

export {
  callJudge,
  collectToolCall,
  extractJsonVerdict,
  parseVerdict,
};
