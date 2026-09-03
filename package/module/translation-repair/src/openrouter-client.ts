import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import pLimit, { type LimitFunction, } from 'p-limit';

import { armCallDeadline, } from './call-deadline.ts';
import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  ChatTextRequest,
  ModelCaller,
} from './chat-contract.ts';
import { readJsonOutcome, } from './chat-json-outcome.ts';
import { SyntheticHttpError, } from './completion-shape.ts';
import { isSuccessStatus, } from './http-success.ts';
import { formatUsageNote, } from './model-content.ts';
import {
  OPENROUTER_AUTH_HEADER,
  OPENROUTER_CHAT_URL,
  OPENROUTER_CREDITS_URL,
  OPENROUTER_PROVIDER_PREFERENCES,
  type OpenRouterServedId,
} from './openrouter-catalog.ts';
import {
  COST_UNREPORTED,
  openRouterCostOf,
} from './openrouter-cost.ts';
import {
  type OpenRouterCredits,
  parseOpenRouterCredits,
} from './openrouter-credits.ts';
import { failureForReply, } from './request-size-refusal.ts';
import type { RosterModelId, } from './roster-id.ts';
import { openRouterIdFor, } from './roster-reach.ts';
import { withSchemaInSystemPrompt, } from './schema-prompt.ts';
import { reportSpend, } from './spend-line.ts';
import {
  extractStreamedCompletion,
  requireStreamTerminator,
} from './stream-completion.ts';
import {
  fetchTransport,
  type ModelTransport,
  type TransportReply,
} from './synthetic-transport.ts';
import {
  DEFAULT_RETRY_POLICY,
  exchangeWithRetry,
  type RetryPolicy,
} from './transient-retry.ts';

//region OpenRouter client
// Third provider's client, over the same transport seam as the first two.
//
// IT SPEAKS THE OPENAI-COMPATIBLE PROTOCOL THE SYNTHETIC CLIENT SPEAKS, by
// measurement rather than by analogy: the probe of 2026-09-03 drove every
// roster model twenty times through chat completions, the Anthropic Messages
// endpoint and the Responses endpoint, and chat completions conformed on
// every attempt and answered fastest on every model, where Messages answered
// Kimi-K3 eight times slower and conformed on 9 of 20 DeepSeek Flash attempts
// (`doc/planning/translation-repair-openrouter-2026-09-03.md`). So the body
// is the Synthetic body plus a `provider` field, the stream is read by the
// same reader, and the only things this file adds are the ones that ARE
// different: the spelling of the model name, the routing preferences, a
// credits meter in USD, and the cost the wire reports per call.
//
// IT THROWS THE SAME FAILURE CLASS AS THE FIRST PROVIDER, for the reason
// `hyper-client.ts` records: `benchmark.ts` branches on it to read a status
// off a failed call, and a fresh class here would make that site blind to
// exactly the provider added to survive the others' exhaustion.
//
// NO REQUEST PACER AND NO PER-MODEL CEILING BY DEFAULT. The provider states
// no request-rate limit for paid models beyond DDoS protection, and routes
// each model's calls across many upstreams; the probe ran twelve calls per
// model in flight without a refusal. A width past that is unmeasured, which
// is why the limiter seam stays injectable.

/**
 * Local representation of this provider's absence of a per-model ceiling.
 *
 * @example
 * ```ts
 * const width = OPENROUTER_PER_MODEL_CONCURRENCY;
 * ```
 */
export const OPENROUTER_PER_MODEL_CONCURRENCY: number = Number.POSITIVE_INFINITY;

/**
 * Logger root for this package's model-facing shell.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Refusal raised when a roster model has no spelling on this provider.
 *
 * A THROW RATHER THAN A DATA OUTCOME, because it is a routing mistake in our
 * own code and not a thing a model did.
 *
 * @example
 * ```ts
 * throw new OpenRouterModelNotServedError({ modelId, },);
 * ```
 */
export class OpenRouterModelNotServedError extends Error {
  /**
   * Declares this message safe to forward: it names a model.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Builds failure naming the model this provider has no spelling for.
   *
   * @param modelId - roster model that was addressed here
   *
   * @example
   * ```ts
   * new OpenRouterModelNotServedError({ modelId: 'hf:Qwen/Qwen3.8-27B', },);
   * ```
   */
  public constructor({ modelId, }: { readonly modelId: string; },) {
    super(`OpenRouter does not serve ${modelId}; route it to another provider or pick another model`,);
    this.name = 'OpenRouterModelNotServedError';
  }
}

/**
 * Client surface for the per-token USD provider.
 *
 * @example
 * ```ts
 * const client: OpenRouterClient = createOpenRouterClient({ apiKey, },);
 * ```
 */
export type OpenRouterClient = ModelCaller & {
  /**
   * Credits purchased, used and remaining, which is this provider's whole
   * budget signal.
   */
  readonly credits: (args: { readonly signal: AbortSignal; },) => Promise<OpenRouterCredits>;
};

/**
 * Refuses a success reply whose server-sent stream stopped before its terminator.
 *
 * @param attemptReply - one attempt's reply, read before the ladder returns it
 *
 * @throws MalformedCompletionError - when a success body stops before
 * `[DONE]`, which is what puts a truncated stream on the retry path
 * instead of past it
 *
 * @example
 * ```ts
 * const reply = await exchangeWithRetry({ transport, exchange, policy, verify: wholeMessage, },);
 * ```
 */
function wholeMessage(attemptReply: TransportReply,): void {
  if (isSuccessStatus({ status: attemptReply.status, },))
    requireStreamTerminator({ bodyText: attemptReply.bodyText, },);
}

/**
 * Builds one client over injected transport, speaking chat completions.
 *
 * @param apiKey - bearer token; never logged
 *
 * @param transport - HTTP seam; tests inject recorded replies
 *
 * @param chatUrl - completion endpoint, overridable for tests
 *
 * @param creditsUrl - credits endpoint, overridable for tests
 *
 * @param perModelConcurrency - optional local test or caller bound; normal
 * operation is unbounded because the provider states no ceiling
 *
 * @param retryPolicy - transient-retry pacing; tests pass tiny backoffs
 *
 * @returns Client surface with chatText, chatJson, and credits
 *
 * @example
 * ```ts
 * const client = createOpenRouterClient({ apiKey: process.env['TRANSLATION_REPAIR_OPENROUTER_API_KEY'] ?? '', },);
 * ```
 */
export function createOpenRouterClient(
  {
    apiKey,
    transport = fetchTransport,
    chatUrl = OPENROUTER_CHAT_URL,
    creditsUrl = OPENROUTER_CREDITS_URL,
    perModelConcurrency = OPENROUTER_PER_MODEL_CONCURRENCY,
    retryPolicy = DEFAULT_RETRY_POLICY,
  }: {
    readonly apiKey: string;
    readonly transport?: ModelTransport;
    readonly chatUrl?: string;
    readonly creditsUrl?: string;
    readonly perModelConcurrency?: number;
    readonly retryPolicy?: RetryPolicy;
  },
): OpenRouterClient {
  /**
   * Per-model limiters keyed by roster model, created lazily.
   */
  const limiters = new Map<RosterModelId, LimitFunction>();

  /**
   * Headers shared by every exchange, auth included.
   */
  const headers: Readonly<Record<string, string>> = {
    [OPENROUTER_AUTH_HEADER]: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  };

  /**
   * Returns the model's limiter, creating its slots on first use.
   *
   * @param modelId - model whose slot the exchange needs
   *
   * @returns Limiter granting the model `perModelConcurrency` slots
   *
   * @example
   * ```ts
   * const limit = limiterFor('minimax-m3',);
   * ```
   */
  function limiterFor(modelId: RosterModelId,): LimitFunction {
    /**
     * Existing limiter when this model was called before.
     */
    const existing = limiters.get(modelId,);
    if (existing !== undefined)
      return existing;

    /**
     * Fresh limiter for first use of this model.
     */
    const created = pLimit(perModelConcurrency,);
    limiters.set(
      modelId,
      created,
    );
    return created;
  }

  /**
   * Spells one roster model the way this provider names it.
   *
   * @param modelId - roster model the caller addressed
   *
   * @returns Wire identifier for the request body
   *
   * @throws {@link OpenRouterModelNotServedError} when this provider serves no such model
   *
   * @example
   * ```ts
   * const served = servedIdFor({ modelId, },);
   * ```
   */
  function servedIdFor(
    { modelId, }: { readonly modelId: RosterModelId; },
  ): OpenRouterServedId {
    /**
     * Spelling this provider uses, or that it serves no such model.
     */
    const spelling = openRouterIdFor({ modelId, },);

    if (!spelling.served)
      throw new OpenRouterModelNotServedError({ modelId, },);
    return spelling.id;
  }

  /**
   * Free-text chat exchange; bounded per model where a bound was given.
   *
   * @param request - exchange to perform
   *
   * @mutates request - `JSON.stringify` may invoke toJSON methods or getters while serializing messages and response format
   *
   * @returns Content text and usage when reported
   *
   * @throws {@link OpenRouterModelNotServedError} when this provider serves no such model
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @throws {@link import('./completion-shape.ts').MalformedCompletionError} on a stream that never terminated
   *
   * @example
   * ```ts
   * const reply = await client.chatText({ modelId, messages, signal, },);
   * ```
   */
  async function chatText(request: ForeignBorrowed<ChatTextRequest>,): Promise<ChatTextReply> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: chatText.name,
      l,
    },);

    /**
     * Wire spelling, resolved BEFORE the slot is taken so a misrouted call
     * fails at once instead of queueing behind live ones.
     */
    const servedId = servedIdFor({ modelId: request.modelId, },);

    return await limiterFor(request.modelId,)(async function performExchange() {
      /**
       * Message count for the entry log line.
       */
      const messageCount = request
        .messages
        .length;

      rl.debug(`-> ${servedId}: ${String(messageCount,)} messages`,);

      /**
       * Per-exchange deadline armed inside the slot so local queue wait
       * behind concurrent same-model calls never counts against it;
       * absent when the caller set no deadline.
       */
      using deadline = request.exchangeTimeoutMs === undefined
        ? undefined
        : armCallDeadline({
          signal: request.signal,
          timeoutMs: request.exchangeTimeoutMs,
          label: servedId,
        },);

      /**
       * Signal the exchange honors: deadline-joined when armed.
       */
      const exchangeSignal = deadline === undefined
        ? request.signal
        : deadline.callSignal;

      /**
       * Messages as they go on the wire, carrying this call's own response
       * schema inside the system prompt, as on the Synthetic path (`#216`).
       */
      const asked = withSchemaInSystemPrompt({
        messages: request.messages,
        // Conditional spread keeps the knob absent instead of undefined.
        ...(request.responseFormat === undefined
          ? {}
          : { responseFormat: request.responseFormat, }),
      },);

      /**
       * Exactly what goes on the wire, hoisted so its size can be measured.
       *
       * NO THINKING PARAMETER AND NO TOKEN BUDGET, EVER, the owner's standing
       * instruction of 2026-08-25, recorded in full at the Synthetic body.
       */
      const bodyJson = JSON.stringify({
        model: servedId,
        messages: asked,
        stream: true,
        stream_options: { include_usage: true, },
        provider: OPENROUTER_PROVIDER_PREFERENCES,
        // Conditional spreads keep optional knobs absent instead of undefined.
        ...(request.maxTokens === undefined
          ? {}
          : { max_tokens: request.maxTokens, }),
        ...(request.responseFormat === undefined
          ? {}
          : { response_format: request.responseFormat, }),
      },);

      /**
       * Raw reply from the transport seam, retried on transient statuses.
       */
      const reply = await exchangeWithRetry({
        transport,
        exchange: {
          url: chatUrl,
          label: servedId,
          method: 'POST',
          headers,
          bodyJson,
          signal: exchangeSignal,
          // Conditional spread keeps the knob absent instead of undefined.
          ...(request.maxAnswerChars === undefined
            ? {}
            : { maxAnswerChars: request.maxAnswerChars, }),
        },
        policy: retryPolicy,
        // A TRUNCATED BODY IS A TRANSPORT FAILURE WEARING A SUCCESS STATUS,
        // so the ladder reads it inside its own try and retries the attempt.
        verify: wholeMessage,
      },);

      if (!isSuccessStatus({ status: reply.status, },)) {
        rl.warn(`<- ${servedId}: HTTP ${String(reply.status,)}`,);

        // BYTES RATHER THAN CHARACTERS: this corpus is Chinese, and one
        // character costs three bytes in UTF-8.
        throw failureForReply({
          status: reply.status,
          bodyText: reply.bodyText,
          requestBodyBytes: Buffer.byteLength(bodyJson,),
        },);
      }

      /**
       * Content and usage reassembled from the drained event stream.
       */
      const extracted = extractStreamedCompletion({ bodyText: reply.bodyText, },);

      /**
       * USD this call was charged, as the final chunk reported it.
       */
      const cost = openRouterCostOf({ bodyText: reply.bodyText, },);

      /**
       * Content length for the completion log line.
       */
      const textLength = extracted
        .text
        .length;

      rl.debug(
        `<- ${servedId}: ${String(textLength,)} chars${formatUsageNote({ extracted, },)}`,
      );
      reportSpend({
        provider: 'openrouter',
        label: servedId,
        extracted,
        // Conditional spread keeps the field absent where the wire sent none.
        ...((cost === COST_UNREPORTED)
          ? {}
          : { costUsd: cost, }),
      },);
      return extracted;
    },);
  }

  /**
   * Schema-validated chat exchange.
   *
   * @param request - exchange plus content guard
   *
   * @mutates request - `JSON.stringify` may invoke toJSON methods or getters while the delegated exchange serializes messages and response format
   *
   * @returns Outcome as data: ok, refusal-shaped, or schema-mismatch
   *
   * @throws {@link OpenRouterModelNotServedError} when this provider serves no such model
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @example
   * ```ts
   * const outcome = await client.chatJson({ modelId, messages, signal, validate: isVerdict, },);
   * ```
   */
  async function chatJson<ValueT,>(
    request: ForeignBorrowed<ChatJsonRequest<ValueT>>,
  ): Promise<ChatJsonOutcome<ValueT>> {
    /**
     * Raw text reply of the underlying exchange.
     */
    const reply = await chatText({
      modelId: request.modelId,
      messages: request.messages,
      signal: request.signal,
      // Conditional spreads keep optional knobs absent instead of undefined.
      ...(request.exchangeTimeoutMs === undefined
        ? {}
        : { exchangeTimeoutMs: request.exchangeTimeoutMs, }),
      ...(request.maxAnswerChars === undefined
        ? {}
        : { maxAnswerChars: request.maxAnswerChars, }),
      ...(request.maxTokens === undefined
        ? {}
        : { maxTokens: request.maxTokens, }),
      ...(request.responseFormat === undefined
        ? {}
        : { responseFormat: request.responseFormat, }),
    },);

    return readJsonOutcome({
      modelId: request.modelId,
      reply,
      validate: request.validate,
    },);
  }

  /**
   * Reads credits purchased and used, which is this provider's whole budget
   * signal.
   *
   * @param signal - abort signal honored for the read
   *
   * @returns Typed credits
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @throws {@link import('./openrouter-credits.ts').OpenRouterCreditsShapeError} on contract-violating bodies
   *
   * @example
   * ```ts
   * const { remainingUsd, } = await client.credits({ signal, },);
   * ```
   */
  async function credits(
    { signal, }: { readonly signal: AbortSignal; },
  ): Promise<OpenRouterCredits> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: credits.name,
      l,
    },);

    /**
     * Raw reply from the credits endpoint, retried on transient statuses.
     */
    const reply = await exchangeWithRetry({
      transport,
      exchange: {
        url: creditsUrl,
        label: 'credits',
        method: 'GET',
        headers,
        signal,
      },
      policy: retryPolicy,
    },);

    if (!isSuccessStatus({ status: reply.status, },))
      throw new SyntheticHttpError({
        status: reply.status,
        bodyText: reply.bodyText,
        summary: `OpenRouter /credits returned HTTP ${String(reply.status,)}:`,
      },);

    /**
     * Typed credits parsed from the verified body shape.
     */
    const parsed = parseOpenRouterCredits({ bodyText: reply.bodyText, },);

    rl.debug(`remaining ${parsed.remainingUsd.toFixed(2,)} USD`,);
    return parsed;
  }

  return {
    chatText,
    chatJson,
    credits,
  };
}

//endregion OpenRouter client
