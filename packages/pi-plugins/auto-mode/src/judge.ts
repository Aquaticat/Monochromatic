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
  AssistantMessageEventStream,
  Context,
  Model,
  ProviderStreams,
  SimpleStreamOptions,
} from '@earendil-works/pi-ai';
import { anthropicMessagesApi, } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { azureOpenAIResponsesApi, } from '@earendil-works/pi-ai/api/azure-openai-responses.lazy';
import { bedrockConverseStreamApi, } from '@earendil-works/pi-ai/api/bedrock-converse-stream.lazy';
import { googleGenerativeAIApi, } from '@earendil-works/pi-ai/api/google-generative-ai.lazy';
import { googleVertexApi, } from '@earendil-works/pi-ai/api/google-vertex.lazy';
import { mistralConversationsApi, } from '@earendil-works/pi-ai/api/mistral-conversations.lazy';
import { openAICodexResponsesApi, } from '@earendil-works/pi-ai/api/openai-codex-responses.lazy';
import { openAICompletionsApi, } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { openAIResponsesApi, } from '@earendil-works/pi-ai/api/openai-responses.lazy';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts/foreign-borrowed.ts';
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
import type {
  BatchEntry,
  BudgetModelAuth,
  Verdict,
} from './types.ts';

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

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
 * const streamFn: JudgeStreamSimple = streams.streamSimple;
 * ```
 */
type JudgeStreamSimple = ProviderStreams['streamSimple'];

/**
 * Non-compat pi-ai API streams supported by the judge.
 *
 * Direct API dispatch preserves registry-selected custom model records because
 * auto-mode already resolves API keys and headers before calling the judge.
 *
 * @example
 * ```typescript
 * const streams = JUDGE_API_STREAMS.get('openai-completions');
 * ```
 */
const JUDGE_API_STREAMS: ReadonlyMap<string, ProviderStreams> = new Map([
  [
    'anthropic-messages',
    anthropicMessagesApi(),
  ],
  [
    'azure-openai-responses',
    azureOpenAIResponsesApi(),
  ],
  [
    'bedrock-converse-stream',
    bedrockConverseStreamApi(),
  ],
  [
    'google-generative-ai',
    googleGenerativeAIApi(),
  ],
  [
    'google-vertex',
    googleVertexApi(),
  ],
  [
    'mistral-conversations',
    mistralConversationsApi(),
  ],
  [
    'openai-codex-responses',
    openAICodexResponsesApi(),
  ],
  [
    'openai-completions',
    openAICompletionsApi(),
  ],
  [
    'openai-responses',
    openAIResponsesApi(),
  ],
],);

/**
 * Direct pi-ai stream dispatch options.
 */
type DirectJudgeStreamOptions = {
  /**
   * Selected judge model.
   */
  readonly model: Readonly<Model<Api>>;
  /**
   * Context handed to pi-ai streamSimple.
   */
  readonly context: Readonly<Context>;
  /**
   * Simple stream options with resolved auth.
   */
  readonly options?: Readonly<SimpleStreamOptions>;
};

/**
 * Judge stream dispatch options, optionally overriding the default stream implementation.
 */
type JudgeStreamCallOptions = DirectJudgeStreamOptions & {
  /**
   * Test seam or caller-supplied stream implementation.
   */
  readonly streamSimpleFn?: JudgeStreamSimple;
};

/**
 * Stream through pi-ai's direct non-compat API implementation for the model API,
 * looked up from {@link JUDGE_API_STREAMS}.
 *
 * @param model - selected judge model
 *
 * @param context - context handed to pi-ai streamSimple
 *
 * @param options - simple stream options with resolved auth
 *
 * @returns assistant event stream from matching pi-ai API implementation
 *
 * @throws when model API has no direct implementation registered for auto-mode
 *
 * @example
 * ```typescript
 * const stream = defaultJudgeStreamSimple({ model, context, options });
 * ```
 */
function defaultJudgeStreamSimple(
  {
    model,
    context,
    options,
  }: Readonly<DirectJudgeStreamOptions>,
): AssistantMessageEventStream {
  /**
   * Direct API stream implementation matching the selected judge model.
   */
  const streams = JUDGE_API_STREAMS.get(model.api,);
  if (streams === undefined) {
    throw new Error(
      `No pi-ai API implementation available for judge model api "${model.api}" (${model.provider}/${model.id})`,
    );
  }
  return streams.streamSimple(
    model,
    context,
    options,
  );
}

/**
 * Route judge streaming through a supplied test seam or {@link defaultJudgeStreamSimple}'s
 * direct pi-ai API map.
 *
 * @param streamSimpleFn - optional caller-supplied stream implementation
 *
 * @param model - selected judge model
 *
 * @param context - context handed to pi-ai streamSimple
 *
 * @param options - simple stream options with resolved auth
 *
 * @returns assistant event stream from supplied or default implementation
 *
 * @example
 * ```typescript
 * const stream = streamJudgeSimple({ model, context, options });
 * ```
 */
function streamJudgeSimple(
  {
    streamSimpleFn,
    model,
    context,
    options,
  }: Readonly<JudgeStreamCallOptions>,
): AssistantMessageEventStream {
  if (streamSimpleFn
    !== undefined) {
    return streamSimpleFn(
      model,
      context,
      options,
    );
  }
  if (options !== undefined) {
    return defaultJudgeStreamSimple({
      model,
      context,
      options,
    },);
  }
  return defaultJudgeStreamSimple({
    model,
    context,
  },);
}

//region Public API

/**
 * Call the judge model and return a structured verdict.
 *
 * Uses forced `tool_choice` for the first attempt. If the response omits
 * `render_verdict`, retries once with no tools and asks for direct JSON.
 *
 * Delegates to:
 * - {@link buildUserContent} to assemble the user message
 * - {@link toolChoiceForApi} to select the forced tool choice for the first attempt
 * - {@link streamJudgeSimple} for both the initial and retry streams
 * - {@link disposableTimeout} to bound the call with the timeout budget
 * - {@link buildStreamOptions} to build stream options for each attempt
 * - {@link buildJsonRetrySystemPrompt} and {@link buildJsonRetryUserContent} to build the retry prompt
 * - {@link collectJudgeVerdictArgs} to collect verdict arguments from either path
 * - {@link parseVerdict} to convert the raw arguments into a verdict
 * - {@link VERDICT_TOOL} as the forced tool definition
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
 * @param abortSignal - outer cancellation signal, used to stop a losing fallback contender
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
    abortSignal,
    streamSimpleFn,
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
    readonly abortSignal?: ForeignBorrowed<AbortSignal>;
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
   * Signal that aborts when this model exhausts its own timeout or an outer fallback race settles.
   */
  const signal = abortSignal === undefined
    ? controller.signal
    : (function mergeFallbackAbortSignals(): AbortSignal {
      return AbortSignal.any([
        controller.signal,
        abortSignal,
      ],);
    })();

  /**
   * API-specific forced tool-call selector for the initial judge invocation.
   */
  const toolChoice = toolChoiceForApi(String(model.api,),);

  /**
   * Streaming event source for the initial forced-tool judge invocation.
   */
  const toolCallStream = streamJudgeSimple({
    ...(streamSimpleFn !== undefined ? { streamSimpleFn, } : {}),
    model,
    context: {
      systemPrompt,
      messages,
      tools: [VERDICT_TOOL,],
    },
    options: buildStreamOptions({
      auth,
      signal,
      toolChoice,
    },),
  },);

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
    return streamJudgeSimple({
      ...(streamSimpleFn !== undefined ? { streamSimpleFn, } : {}),
      model,
      context: {
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
      options: buildStreamOptions({
        auth,
        signal,
      },),
    },);
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
