/**
 * LLM-as-judge for tool call evaluation.
 *
 * Calls a budget model with forced tool-calling, retries with a direct JSON
 * prompt when no tool call is emitted, and converts the raw arguments into a
 * structured Verdict.
 *
 * @module
 */

import type {
  Api,
  AssistantMessageEvent,
  Model,
} from '@earendil-works/pi-ai';
import { streamSimple, } from '@earendil-works/pi-ai/compat';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  toolChoiceForApi,
  VERDICT_TOOL,
} from './judge-tool.ts';
import {
  buildJsonRetrySystemPrompt,
  buildJsonRetryUserContent,
  buildUserContent,
} from './judge-messages.ts';
import { parseVerdict, } from './judge-json.ts';
import {
  buildStreamOptions,
  disposableTimeout,
} from './judge-runtime.ts';
import { collectJudgeVerdictArgs, } from './judge-stream.ts';
import { l as parentLogger, } from './log.ts';
import type {
  BatchEntry,
  BudgetModelAuth,
  Verdict,
} from './types.ts';

/**
 * Tagged logger for the judge module.
 */
const l = tagged({
  tag: 'judge',
  l: parentLogger,
},);

/**
 * Stream function used by the judge.
 *
 * @example
 * ```typescript
 * const streamFn: JudgeStreamSimple = streamSimple;
 * ```
 */
type JudgeStreamSimple = typeof streamSimple;

//region Public API

/**
 * Call the judge model and return a structured verdict.
 *
 * Uses forced `tool_choice` for the first attempt. If the response omits
 * `render_verdict`, retries once with no tools and asks for direct JSON.
 *
 * @param model - selected judge model
 *
 * @param auth - credentials and headers for the judge model
 *
 * @param action - human-readable action under review
 *
 * @param cwd - agent working directory
 *
 * @param recentContext - recent session activity for circumvention checks
 *
 * @param trustDirectives - active user-approved trust directives
 *
 * @param timeoutMs - total timeout budget for both judge attempts
 *
 * @param systemPrompt - judge safety rubric
 *
 * @param batchContext - sibling actions already evaluated in this turn
 *
 * @param streamSimpleFn - stream implementation used for model calls
 *
 * @returns judge's verdict
 *
 * @example
 * ```typescript
 * const verdict = await callJudge({
 *   model,
 *   auth,
 *   action: 'bash: sudo apt-get install cowsay',
 *   cwd: '/project',
 *   recentContext: context,
 *   trustDirectives: [],
 *   timeoutMs: 10_000,
 *   systemPrompt: prompt,
 *   batchContext: [],
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
    streamSimpleFn = streamSimple,
  }: {
    readonly model: Model<Api>;
    readonly auth: BudgetModelAuth;
    readonly action: string;
    readonly cwd: string;
    readonly recentContext: string;
    readonly trustDirectives: readonly string[];
    readonly timeoutMs: number;
    readonly systemPrompt: string;
    readonly batchContext: readonly BatchEntry[];
    readonly streamSimpleFn?: JudgeStreamSimple;
  },
): Promise<Verdict> {
  /**
   * Per-call sub-logger so log lines from this entry point carry the function name as a tag.
   */
  const innerL = tagged({
    tag: callJudge.name,
    l,
  },);
  innerL.debug(`calling ${model.provider}/${model.id} for action: ${action}`,);

  /**
   * Rendered user-message body that bundles action, context, directives, and batch siblings.
   */
  const userContent = buildUserContent({
    action,
    cwd,
    recentContext,
    trustDirectives,
    batchContext,
  },);

  /**
   * Single-turn user message array handed to the streaming entry point.
   */
  const messages = [
    {
      role: 'user' as const,
      content: userContent,
      timestamp: Date.now(),
    },
  ];

  /**
   * Abort controller wired into the timeout disposable and both stream calls.
   */
  const controller = new AbortController();
  /**
   * Disposable timer; on scope exit it clears the timeout regardless of how the function returns.
   */
  using _timer = disposableTimeout({
    ms: timeoutMs,
    onTimeout() {
      controller.abort();
    },
  },);

  /**
   * API-specific forced tool-call selector for the initial judge invocation.
   */
  const toolChoice = toolChoiceForApi(String(model.api,),);

  /**
   * Streaming event source for the initial forced-tool judge invocation.
   */
  const toolCallStream = streamSimpleFn(
    model,
    {
      systemPrompt,
      messages,
      tools: [VERDICT_TOOL,],
    },
    buildStreamOptions({
      auth,
      controller,
      toolChoice,
    },),
  );

  /**
   * Lazily create the direct JSON retry stream only after the first response omits `render_verdict`.
   *
   * @param firstAttemptTextContent - first-attempt diagnostic text
   *
   * @returns stream for the direct JSON retry response
   *
   * @example
   * ```typescript
   * const retryStream = createJsonRetryStream({ firstAttemptTextContent: '' });
   * ```
   */
  function createJsonRetryStream(
    {
      firstAttemptTextContent,
    }: {
      readonly firstAttemptTextContent: string;
    },
  ): AsyncIterable<AssistantMessageEvent> {
    return streamSimpleFn(
      model,
      {
        systemPrompt: buildJsonRetrySystemPrompt({ systemPrompt, },),
        messages: [
          {
            role: 'user' as const,
            content: buildJsonRetryUserContent({
              userContent,
              firstAttemptTextContent,
            },),
            timestamp: Date.now(),
          },
        ],
      },
      buildStreamOptions({
        auth,
        controller,
      },),
    );
  }

  /**
   * Parsed verdict arguments from the forced-tool path or direct JSON retry.
   */
  const result = await collectJudgeVerdictArgs({
    toolCallStream,
    createJsonRetryStream,
  },);
  return parseVerdict(result,);
}

//endregion

export { callJudge, };
export {
  extractJsonVerdict,
  parseVerdict,
} from './judge-json.ts';
export {
  collectJudgeVerdictArgs,
  collectToolCall,
} from './judge-stream.ts';
