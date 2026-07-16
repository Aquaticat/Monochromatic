/**
 * Complete structured reviewer transport attempt.
 *
 * @module
 */

import type {
  AssistantMessageEventStream,
  Context,
  SimpleStreamOptions,
  Tool,
} from '@earendil-works/pi-ai';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { streamStructuredReview, } from './provider-streams.ts';
import { collectStructuredReviewValue, } from './stream-collection.ts';
import { toolChoiceForApi, } from './tool-choice.ts';
import type {
  StructuredReviewAttemptOptions,
  StructuredReviewPrompt,
} from './types.ts';

/**
 * Shared package logger.
 */
const parentLogger = tagged({ tag: 'model-review', },);

/**
 * Attempt transport logger.
 */
const l = tagged({
  tag: 'attempt',
  l: parentLogger,
},);

/**
 * Build cancellation signal covering caller abort and attempt timeout.
 *
 * @param signal - optional caller cancellation signal
 *
 * @param timeoutMs - complete attempt timeout
 *
 * @returns composed abort signal
 *
 * @mutates signal - DOM commit 5796f716 AbortSignal.any dependent-signal relations can retain supplied caller signal
 *
 * @example
 * ```ts
 * attemptSignal({ timeoutMs: 10_000 });
 * ```
 */
function attemptSignal(
  {
    signal,
    timeoutMs,
  }: ForeignBorrowed<Readonly<{
    signal?: AbortSignal;
    timeoutMs: number;
  }>>,
): AbortSignal {
  /**
   * Timeout-only abort signal.
   */
  const timeoutSignal = AbortSignal.timeout(timeoutMs,);
  return signal === undefined
    ? timeoutSignal
    : AbortSignal.any([
      signal,
      timeoutSignal,
    ],);
}

/**
 * Build Pi AI stream options without widening absent auth fields.
 *
 * @param auth - caller-resolved provider credentials
 *
 * @param signal - complete attempt cancellation signal
 *
 * @param toolChoice - optional provider-specific forced tool selector
 *
 * @param maxOutputTokens - optional output cap
 *
 * @returns stream options
 *
 * @example
 * ```ts
 * buildAttemptStreamOptions({ auth: {}, signal: AbortSignal.timeout(1000) });
 * ```
 */
function buildAttemptStreamOptions(
  {
    auth,
    signal,
    toolChoice,
    maxOutputTokens,
  }: Pick<StructuredReviewAttemptOptions<unknown>, 'auth' | 'maxOutputTokens'> & {
    readonly signal: AbortSignal;
    readonly toolChoice?: unknown;
  },
): SimpleStreamOptions {
  /**
   * Stream options assembled from present caller fields.
   */
  const options: SimpleStreamOptions = {
    signal,
    ...(auth.apiKey === undefined ? {} : { apiKey: auth.apiKey, }),
    ...(auth.headers === undefined ? {} : { headers: { ...auth.headers, }, }),
    ...(toolChoice === undefined ? {} : { toolChoice, }),
    ...(maxOutputTokens === undefined ? {} : { maxTokens: maxOutputTokens, }),
  };
  return options;
}

/**
 * Build one-message provider context from caller prompt.
 *
 * @param prompt - reviewer system and user content
 *
 * @param tool - optional structured tool for initial attempt
 *
 * @returns Pi AI provider context
 *
 * @example
 * ```ts
 * contextForPrompt({ prompt: { systemPrompt: 'Judge.', userContent: 'Evidence' } });
 * ```
 */
function contextForPrompt(
  {
    prompt,
    tool,
  }: {
    readonly prompt: StructuredReviewPrompt;
    readonly tool?: Readonly<Tool>;
  },
): Context {
  return {
    systemPrompt: prompt.systemPrompt,
    messages: [{
      role: 'user',
      content: prompt.userContent,
      timestamp: Date.now(),
    },],
    ...(tool === undefined ? {} : { tools: [tool,], }),
  };
}

/**
 * Run one complete forced-tool and direct-JSON reviewer attempt.
 *
 * @param model - selected reviewer model
 *
 * @param auth - resolved provider credentials
 *
 * @param prompt - initial reviewer prompt
 *
 * @param contract - structured verdict contract
 *
 * @param timeoutMs - timeout across complete candidate attempt
 *
 * @param maxOutputTokens - optional provider output cap
 *
 * @param signal - optional caller cancellation signal
 *
 * @param stream - optional injected provider stream
 *
 * @returns strictly parsed caller verdict
 *
 * @mutates model - provider stream may inspect or retain selected model data
 *
 * @mutates contract - parser and retry-prompt callbacks may update caller-owned captured state
 *
 * @mutates signal - `AbortSignal.any` may retain supplied caller signal
 *
 * @mutates stream - injected provider stream may update caller-owned captured state
 *
 * @throws when transport or caller contract fails
 *
 * @example
 * ```ts
 * const verdict = await runStructuredReviewAttempt(options);
 * ```
 */
async function runStructuredReviewAttempt<TVerdict,>(
  {
    model,
    auth,
    prompt: reviewPrompt,
    contract,
    timeoutMs,
    maxOutputTokens,
    signal: callerSignal,
    stream,
  }: StructuredReviewAttemptOptions<TVerdict>,
): Promise<TVerdict> {
  /**
   * Per-call logger carrying selected reviewer identity.
   */
  const innerL = tagged({
    tag: runStructuredReviewAttempt.name,
    l,
  },);
  innerL.debug(
    `starting structured attempt with ${model.provider}/${model.id} using ${contract.toolName}`,
  );
  /**
   * Composed cancellation signal shared by every retry.
   */
  const signal = attemptSignal({
    ...(callerSignal === undefined ? {} : { signal: callerSignal, }),
    timeoutMs,
  },);

  /**
   * Dispatch one provider stream through injected or production adapter.
   *
   * @param prompt - provider prompt
   *
   * @param streamOptions - provider options
   *
   * @param tool - optional forced structured tool
   *
   * @returns reviewer event stream
   *
   * @mutates prompt - provider consumes caller prompt data
   *
   * @mutates streamOptions - provider observes signal and auth capabilities
   *
   * @example
   * ```ts
   * dispatch({ prompt: reviewPrompt, streamOptions });
   * ```
   */
  function dispatch(
    {
      prompt,
      streamOptions,
      tool,
    }: ForeignBorrowed<Readonly<{
      readonly prompt: ForeignBorrowed<StructuredReviewPrompt>;
      readonly streamOptions: ForeignBorrowed<SimpleStreamOptions>;
      readonly tool?: ForeignBorrowed<Tool>;
    }>>,
  ): AssistantMessageEventStream {
    /**
     * Provider context for selected prompt.
     */
    const context = contextForPrompt({
      prompt,
      ...(tool === undefined ? {} : { tool, }),
    },);
    return streamStructuredReview({
      ...(stream === undefined ? {} : { stream, }),
      model,
      context,
      options: streamOptions,
    },);
  }

  /**
   * Initial forced-tool event stream.
   */
  const toolCallStream = dispatch({
    prompt: reviewPrompt,
    tool: contract.tool,
    streamOptions: buildAttemptStreamOptions({
      auth,
      signal,
      toolChoice: toolChoiceForApi({
        api: model.api,
        toolName: contract.toolName,
      },),
      ...(maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens, }),
    },),
  },);

  /**
   * Unknown structured value collected from tool or JSON retry.
   */
  const value = await collectStructuredReviewValue({
    toolCallStream,
    expectedToolName: contract.toolName,
    createJsonRetryStream({ firstAttemptTextContent, },) {
      /**
       * Caller-specific retry prompt preserving original rubric.
       */
      const retryPrompt = contract.buildJsonRetryPrompt({
        initialPrompt: reviewPrompt,
        firstAttemptTextContent,
      },);
      return dispatch({
        prompt: retryPrompt,
        streamOptions: buildAttemptStreamOptions({
          auth,
          signal,
          ...(maxOutputTokens === undefined
            ? {}
            : { maxOutputTokens, }),
        },),
      },);
    },
  },);
  /**
   * Strict caller parser owns verdict semantics.
   */
  const verdict = contract.parse(value,);
  innerL.debug(
    `structured attempt completed with ${model.provider}/${model.id}`,
  );
  return verdict;
}

export { runStructuredReviewAttempt, };
