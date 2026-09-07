import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import pLimit, { type LimitFunction, } from 'p-limit';

import {
  BEDROCK_AUTH_HEADER,
  BEDROCK_MANTLE_BASE_URL,
  BEDROCK_MODELS,
  bedrockChatUrlFor,
  type BedrockServedId,
} from './bedrock-catalog.ts';
import {
  BEDROCK_COST_UNREPORTED,
  bedrockCostOf,
} from './bedrock-cost.ts';
import type {
  BedrockCredits,
  BedrockLedger,
} from './bedrock-ledger.ts';
import {
  requireBedrockStreamEnd,
  withDoneSentinel,
} from './bedrock-stream-end.ts';
import { armCallDeadline, } from './call-deadline.ts';
import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  ChatTextRequest,
  ModelCaller,
} from './chat-contract.ts';
import { readJsonOutcome, } from './chat-json-outcome.ts';
import { isSuccessStatus, } from './http-success.ts';
import { formatUsageNote, } from './model-content.ts';
import { failureForReply, } from './request-size-refusal.ts';
import type { RosterModelId, } from './roster-id.ts';
import { bedrockIdFor, } from './roster-reach.ts';
import { withSchemaInSystemPrompt, } from './schema-prompt.ts';
import { reportSpend, } from './spend-line.ts';
import { extractStreamedCompletion, } from './stream-completion.ts';
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

//region Bedrock client
// Fourth provider's client, over the same transport seam as the first three.
//
// IT SPEAKS THE OPENAI-COMPATIBLE PROTOCOL THE OTHER CLIENTS SPEAK, by
// measurement on 2026-09-07 (`bedrock-catalog.ts` records the probes): chat
// completions with `stream` and `stream_options.include_usage`, a json_schema
// `response_format`, `max_tokens` where a caller set one. What this file adds
// are the things that ARE different: the route each model answers on, the
// terminator each route ends with, a cost computed here rather than read off
// the wire, and a meter that is a file rather than an endpoint.
//
// RAW FETCH BY THE OWNER'S INSTRUCTION of 2026-09-07 ("Please do not
// introduce Amazon Bedrock SDK, Anthropic SDK, OpenAI SDK because these are
// poorly written. Use raw fetch."): the transport seam is `fetch`.
//
// IT THROWS THE SAME FAILURE CLASS AS THE FIRST PROVIDER, for the reason
// `hyper-client.ts` records: `benchmark.ts` branches on it to read a status
// off a failed call, and a fresh class here would make that site blind to
// exactly the provider added to survive the others' exhaustion.
//
// NO REQUEST PACER AND NO PER-MODEL CEILING BY DEFAULT. The mantle endpoint
// enforces no requests-per-minute quota and publishes no token quota for
// these models ("their throughput is governed by internal service capacity",
// its quota page, read 2026-09-07); it asks for retry with backoff on
// throttling, which the transient ladder does, and for a gradual ramp, which
// the pipeline's slice fan-out is. A width past what a pass drives is
// unmeasured, which is why the limiter seam stays injectable.

/**
 * Local representation of this provider's absence of a per-model ceiling.
 *
 * @example
 * ```ts
 * const width = BEDROCK_PER_MODEL_CONCURRENCY;
 * ```
 */
export const BEDROCK_PER_MODEL_CONCURRENCY: number = Number.POSITIVE_INFINITY;

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
 * throw new BedrockModelNotServedError({ modelId, },);
 * ```
 */
export class BedrockModelNotServedError extends Error {
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
   * new BedrockModelNotServedError({ modelId: 'hf:Qwen/Qwen3.8-27B', },);
   * ```
   */
  public constructor({ modelId, }: { readonly modelId: string; },) {
    super(`Bedrock does not serve ${modelId}; route it to another provider or pick another model`,);
    this.name = 'BedrockModelNotServedError';
  }
}

/**
 * Client surface for the prepaid per-token USD provider.
 *
 * @example
 * ```ts
 * const client: BedrockClient = createBedrockClient({ apiKey, ledger, },);
 * ```
 */
export type BedrockClient = ModelCaller & {
  /**
   * Credit, spend and what is left, off the ledger, which is this provider's
   * whole budget signal.
   */
  readonly credits: (args: { readonly signal: AbortSignal; },) => Promise<BedrockCredits>;
};

/**
 * Builds one client over injected transport, speaking chat completions.
 *
 * @param apiKey - bearer token; never logged
 *
 * @param ledger - durable spend record the meter reads and every priced call
 * writes
 *
 * @param transport - HTTP seam; tests inject recorded replies
 *
 * @param baseUrl - host both routes hang off, overridable for tests
 *
 * @param perModelConcurrency - optional local test or caller bound; normal
 * operation is unbounded because the provider publishes no ceiling
 *
 * @param retryPolicy - transient-retry pacing; tests pass tiny backoffs
 *
 * @returns Client surface with chatText, chatJson, and credits
 *
 * @example
 * ```ts
 * const client = createBedrockClient({ apiKey: process.env['TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY'] ?? '', ledger, },);
 * ```
 */
export function createBedrockClient(
  {
    apiKey,
    ledger,
    transport = fetchTransport,
    baseUrl = BEDROCK_MANTLE_BASE_URL,
    perModelConcurrency = BEDROCK_PER_MODEL_CONCURRENCY,
    retryPolicy = DEFAULT_RETRY_POLICY,
  }: {
    readonly apiKey: string;
    readonly ledger: BedrockLedger;
    readonly transport?: ModelTransport;
    readonly baseUrl?: string;
    readonly perModelConcurrency?: number;
    readonly retryPolicy?: RetryPolicy;
  },
): BedrockClient {
  /**
   * Per-model limiters keyed by roster model, created lazily.
   */
  const limiters = new Map<RosterModelId, LimitFunction>();

  /**
   * Headers shared by every exchange, auth included.
   */
  const headers: Readonly<Record<string, string>> = {
    [BEDROCK_AUTH_HEADER]: `Bearer ${apiKey}`,
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
   * const limit = limiterFor('google.gemma-4-31b',);
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
   * @throws {@link BedrockModelNotServedError} when this provider serves no such model
   *
   * @example
   * ```ts
   * const served = servedIdFor({ modelId, },);
   * ```
   */
  function servedIdFor(
    { modelId, }: { readonly modelId: RosterModelId; },
  ): BedrockServedId {
    /**
     * Spelling this provider uses, or that it serves no such model.
     */
    const spelling = bedrockIdFor({ modelId, },);

    if (!spelling.served)
      throw new BedrockModelNotServedError({ modelId, },);
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
   * @throws {@link BedrockModelNotServedError} when this provider serves no such model
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @throws {@link import('./completion-shape.ts').MalformedCompletionError} on a stream that never ended the way its route ends
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

    /**
     * How this model's stream says it is whole.
     */
    const { streamEnd, } = BEDROCK_MODELS[servedId];

    /**
     * Refuses a success reply whose stream never ended the way this route
     * ends, so the ladder retries the attempt as the transport failure it is.
     *
     * @param attemptReply - one attempt's reply, read before the ladder returns it
     */
    function wholeMessage(attemptReply: TransportReply,): void {
      if (!isSuccessStatus({ status: attemptReply.status, },))
        return;
      requireBedrockStreamEnd({
        bodyText: attemptReply.bodyText,
        streamEnd,
      },);
    }

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
       * NO THINKING PARAMETER, NO TOKEN BUDGET AND NO REASONING EFFORT, EVER,
       * the owner's standing instruction of 2026-08-25, recorded in full at
       * the Synthetic body; the Gemma 4 cards recommend a reasoning effort
       * and this client sends none.
       */
      const bodyJson = JSON.stringify({
        model: servedId,
        messages: asked,
        stream: true,
        stream_options: { include_usage: true, },
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
          url: bedrockChatUrlFor({
            baseUrl,
            servedId,
          },),
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
       * Content and usage reassembled from the drained event stream, the
       * sentinel supplied where this route ends on its usage chunk.
       */
      const extracted = extractStreamedCompletion({
        bodyText: withDoneSentinel({
          bodyText: reply.bodyText,
          streamEnd,
        },),
      },);

      /**
       * USD this call cost, off the usage and the catalog's prices.
       */
      const cost = bedrockCostOf({
        servedId,
        extracted,
      },);

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
        provider: 'bedrock',
        label: servedId,
        extracted,
        // Conditional spread keeps the field absent where nothing was priced.
        ...((cost === BEDROCK_COST_UNREPORTED)
          ? {}
          : { costUsd: cost, }),
      },);
      /**
       * Usage the provider reported, absent where it did not.
       */
      const { usage, } = extracted;
      if ((cost !== BEDROCK_COST_UNREPORTED) && (usage !== undefined)) {
        await ledger.note({
          at: new Date().toISOString(),
          model: servedId,
          usd: cost,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
        },);
      }
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
   * @throws {@link BedrockModelNotServedError} when this provider serves no such model
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
   * Reads credit, spend and what is left off the ledger, which is this
   * provider's whole budget signal.
   *
   * @param signal - abort signal honored before the read
   *
   * @returns Typed credits
   *
   * @throws {@link import('./bedrock-ledger.ts').BedrockLedgerShapeError} on a ledger line that will not read
   *
   * @example
   * ```ts
   * const { remainingUsd, } = await client.credits({ signal, },);
   * ```
   */
  async function credits(
    { signal, }: { readonly signal: AbortSignal; },
  ): Promise<BedrockCredits> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: credits.name,
      l,
    },);

    signal.throwIfAborted();

    /**
     * What the ledger says.
     */
    const read = await ledger.read();

    /**
     * What is left, for the log line.
     */
    const { remainingUsd, } = read;

    rl.debug(`remaining ${remainingUsd.toFixed(2,)} USD`,);
    return read;
  }

  return {
    chatText,
    chatJson,
    credits,
  };
}

//endregion Bedrock client
