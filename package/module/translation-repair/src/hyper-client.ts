import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import pLimit, { type LimitFunction, } from 'p-limit';

import { extractAnthropicCompletion, } from './anthropic-completion.ts';
import { buildAnthropicBody, } from './anthropic-request.ts';
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
import {
  HYPER_API_VERSION,
  HYPER_AUTH_HEADER,
  HYPER_CREDITS_URL,
  HYPER_MESSAGES_URL,
  type HyperServedId,
} from './hyper-catalog.ts';
import {
  type HyperCredits,
  parseHyperCredits,
} from './hyper-credits.ts';
import { formatUsageNote, } from './model-content.ts';
import { failureForReply, } from './request-size-refusal.ts';
import { reportSpend, } from './spend-line.ts';
import type { RosterModelId, } from './roster-id.ts';
import { hyperIdFor, } from './roster-reach.ts';
import {
  fetchTransport,
  type ModelTransport,
} from './synthetic-transport.ts';
import {
  DEFAULT_RETRY_POLICY,
  exchangeWithRetry,
  type RetryPolicy,
} from './transient-retry.ts';

//region Hyper client
// Second provider's client, over the same transport seam as the first.
//
// WHY A SECOND FILE RATHER THAN A BRANCH. Everything above the wire is shared
// and already extracted: `chat-json-outcome.ts` reads a reply, `transient-retry`
// paces the attempts, and the transport drains the stream under the guards. The
// only things this file adds are the ones that ARE different: a body in a
// different protocol, a different reader for the stream, a different spelling
// of the model name, and a balance instead of a quota.
//
// IT THROWS THE SAME FAILURE CLASS AS THE FIRST PROVIDER, deliberately, even
// though `SyntheticHttpError` is named after the other one. `benchmark.ts`
// branches on `error instanceof SyntheticHttpError` to read a status off a
// failed call, and a fresh class here would make that site silently blind to
// exactly the provider added to survive the other one's exhaustion. The name is
// wrong and the behaviour is right; renaming it is a package-wide change held
// with the `SyntheticClient` rename.
//
// STREAMS ARE READ BY THE ANTHROPIC SCANNER, named on the exchange. A body
// drained with the wrong reader yields an empty answer channel, which every
// guard reads as a well-behaved call that produced nothing, so getting this
// wrong is silent rather than loud.

/**
 * Concurrent requests granted to each model, measured live on 2026-08-24.
 *
 * THIS PROVIDER DOES NOT SERIALISE PER MODEL. Bursts of 4, 8, 16 and 32
 * simultaneous calls to `minimax-m3` all returned schema-valid answers with
 * zero refusals, and each burst finished in about the time ONE call takes: 32
 * calls in 2482ms against a single-call band of 994 to 1641ms over 5 runs.
 * Serialised, those 32 would have taken some 40 seconds. The other provider's
 * bound of one comes from its published rule about subscribed packs and does
 * not transfer here; inheriting it would have cost a factor of 32 in exactly
 * the capacity this provider was added to supply.
 *
 * HELD AT 8 RATHER THAN AT THE 32 PROVEN, because the probe sent a two-line
 * prompt and a corpus call carries orders of magnitude more. What was measured
 * is that the provider accepts the width; what was not measured is 32 large
 * bodies streaming at once through our own drain and guards. Eight is eight
 * times the inherited bound and a quarter of the proven ceiling.
 */
const MEASURED_PER_MODEL_CONCURRENCY = 8;

/**
 * Logger root for this package's model-facing shell.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Refusal raised when a roster model has no spelling on this provider.
 *
 * A THROW RATHER THAN A DATA OUTCOME, because it is a routing mistake in our
 * own code and not a thing a model did. Every outcome this client returns as
 * data describes something a model wrote; a call addressed to a provider that
 * does not serve the model never reaches one.
 *
 * @example
 * ```ts
 * throw new ModelNotServedError({ modelId, },);
 * ```
 */
export class ModelNotServedError extends Error {
  /**
   * Builds failure naming the model this provider has no spelling for.
   *
   * @param modelId - roster model that was addressed here
   *
   * @example
   * ```ts
   * new ModelNotServedError({ modelId: 'hf:Qwen/Qwen3.8-27B', },);
   * ```
   */
  public constructor({ modelId, }: { readonly modelId: string; },) {
    super(`Charm Hyper does not serve ${modelId}; route it to the other provider or pick another model`,);
    this.name = 'ModelNotServedError';
  }
}

/**
 * Client surface for the credit-metered provider.
 *
 * @example
 * ```ts
 * const client: HyperClient = createHyperClient({ apiKey, },);
 * ```
 */
export type HyperClient = ModelCaller & {
  /**
   * Remaining balance, which is this provider's whole budget signal.
   */
  readonly credits: (args: { readonly signal: AbortSignal; },) => Promise<HyperCredits>;
};

/**
 * Builds one client over injected transport, speaking the Messages protocol.
 *
 * @param apiKey - bearer token; never logged
 *
 * @param transport - HTTP seam; tests inject recorded replies
 *
 * @param messagesUrl - completion endpoint, overridable for tests
 *
 * @param creditsUrl - balance endpoint, overridable for tests
 *
 * @param perModelConcurrency - concurrent requests granted to each model;
 * this provider was measured not to serialise per model, so the default is
 * eight rather than the other provider's one
 *
 * @param retryPolicy - transient-retry pacing; tests pass tiny backoffs
 *
 * @returns Client surface with chatText, chatJson, and credits
 *
 * @example
 * ```ts
 * const client = createHyperClient({ apiKey: process.env['TRANSLATION_REPAIR_CHARM_HYPER_API_KEY'] ?? '', },);
 * ```
 */
export function createHyperClient(
  {
    apiKey,
    transport = fetchTransport,
    messagesUrl = HYPER_MESSAGES_URL,
    creditsUrl = HYPER_CREDITS_URL,
    perModelConcurrency = MEASURED_PER_MODEL_CONCURRENCY,
    retryPolicy = DEFAULT_RETRY_POLICY,
  }: {
    readonly apiKey: string;
    readonly transport?: ModelTransport;
    readonly messagesUrl?: string;
    readonly creditsUrl?: string;
    readonly perModelConcurrency?: number;
    readonly retryPolicy?: RetryPolicy;
  },
): HyperClient {
  /**
   * Per-model limiters keyed by roster model, created lazily.
   */
  const limiters = new Map<RosterModelId, LimitFunction>();

  /**
   * Headers shared by every exchange, auth included.
   */
  const headers: Readonly<Record<string, string>> = {
    [HYPER_AUTH_HEADER]: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    'anthropic-version': HYPER_API_VERSION,
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
   * @throws {@link ModelNotServedError} when this provider serves no such model
   *
   * @example
   * ```ts
   * const served = servedIdFor({ modelId, },);
   * ```
   */
  function servedIdFor(
    { modelId, }: { readonly modelId: RosterModelId; },
  ): HyperServedId {
    /**
     * Spelling this provider uses, or that it serves no such model.
     */
    const spelling = hyperIdFor({ modelId, },);

    if (!spelling.served)
      throw new ModelNotServedError({ modelId, },);
    return spelling.id;
  }

  /**
   * Free-text chat exchange; bounded per model.
   *
   * @param request - exchange to perform
   *
   * @mutates request - `JSON.stringify` may invoke toJSON methods or getters while serializing messages and response format
   *
   * @returns Content text and usage when reported
   *
   * @throws {@link ModelNotServedError} when this provider serves no such model
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
     *
     * REACHED SYNCHRONOUSLY DESPITE THE `async`, because an async body runs up
     * to its first `await`, so this still refuses before asking for a slot.
     * The `async` is what turns its throw into a rejection rather than a
     * synchronous exception out of a function that returns a promise.
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
       * Exactly what goes on the wire, hoisted so its size can be measured.
       *
       * THE SCHEMA IS STATED DOWNSTREAM, not here. `buildAnthropicBody` routes
       * every schema-bearing call through `renderToolSystemPrompt`, which
       * prints the whole schema into this protocol's `system` field along with
       * its format rules. `#216` checked before adding a second copy.
       */
      const bodyJson = JSON.stringify(buildAnthropicBody({
        modelId: servedId,
        messages: request.messages,
        // Conditional spreads keep optional knobs absent instead of undefined.
        ...(request.responseFormat === undefined
          ? {}
          : { responseFormat: request.responseFormat, }),
        ...(request.maxTokens === undefined
          ? {}
          : { maxTokens: request.maxTokens, }),
      },),);

      /**
       * Raw reply from the transport seam, retried on transient statuses.
       */
      const reply = await exchangeWithRetry({
        transport,
        exchange: {
          url: messagesUrl,
          label: servedId,
          method: 'POST',
          headers,
          bodyJson,
          signal: exchangeSignal,
          wireFormat: 'anthropic',
          // Conditional spread keeps the knob absent instead of undefined.
          ...(request.maxAnswerChars === undefined
            ? {}
            : { maxAnswerChars: request.maxAnswerChars, }),
        },
        policy: retryPolicy,
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
       * Answer and usage reassembled from the drained event stream, whose
       * answer is usually the tool's arguments rather than any text.
       */
      const extracted = extractAnthropicCompletion({ bodyText: reply.bodyText, },);

      /**
       * Answer length for the completion log line.
       */
      const textLength = extracted
        .text
        .length;

      rl.debug(
        `<- ${servedId}: ${String(textLength,)} chars${formatUsageNote({ extracted, },)}`,
      );
      reportSpend({
        provider: 'hyper',
        label: servedId,
        extracted,
      },);
      return extracted;
    },);
  }

  /**
   * Schema-validated chat exchange.
   *
   * THE SCHEMA TRAVELS AS A TOOL HERE, which `anthropic-request.ts` assembles
   * from the same `responseFormat` the other provider sends verbatim. Callers
   * pass one shape and neither knows nor cares which protocol carried it.
   *
   * @param request - exchange plus content guard
   *
   * @mutates request - `JSON.stringify` may invoke toJSON methods or getters while the delegated exchange serializes messages and response format
   *
   * @returns Outcome as data: ok, refusal-shaped, or schema-mismatch
   *
   * @throws {@link ModelNotServedError} when this provider serves no such model
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
   * Reads the remaining balance, which is this provider's whole budget signal.
   *
   * @param signal - abort signal honored for the read
   *
   * @returns Typed balance
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @throws {@link import('./hyper-credits.ts').CreditsShapeError} on contract-violating bodies
   *
   * @example
   * ```ts
   * const { balance, } = await client.credits({ signal, },);
   * ```
   */
  async function credits(
    { signal, }: { readonly signal: AbortSignal; },
  ): Promise<HyperCredits> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: credits.name,
      l,
    },);

    /**
     * Raw reply from the balance endpoint, retried on transient statuses.
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
        summary: `Charm Hyper /credits returned HTTP ${String(reply.status,)}:`,
      },);

    /**
     * Typed balance parsed from the verified body shape.
     */
    const parsed = parseHyperCredits({ bodyText: reply.bodyText, },);

    rl.debug(`balance ${String(parsed.balance,)}`,);
    return parsed;
  }

  return {
    chatText,
    chatJson,
    credits,
  };
}

//endregion Hyper client
