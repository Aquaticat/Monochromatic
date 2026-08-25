import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import pLimit, { type LimitFunction, } from 'p-limit';

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  ChatTextRequest,
  SyntheticClient,
} from './chat-contract.ts';
import { readJsonOutcome, } from './chat-json-outcome.ts';
import { SyntheticHttpError, } from './completion-shape.ts';
import { isSuccessStatus, } from './http-success.ts';
import { formatUsageNote, } from './model-content.ts';
import { failureForReply, } from './request-size-refusal.ts';
import { withSchemaInSystemPrompt, } from './schema-prompt.ts';
import { reportSpend, } from './spend-line.ts';
import {
  SYNTHETIC_CHAT_BASE_URL,
  SYNTHETIC_QUOTAS_URL,
  type RosterModelId,
} from './synthetic-catalog.ts';
import {
  extractStreamedCompletion,
  requireStreamTerminator,
} from './stream-completion.ts';
import { armCallDeadline, } from './call-deadline.ts';
import {
  parseQuotaSnapshot,
  type QuotaSnapshot,
} from './synthetic-quota.ts';
import {
  DEFAULT_RETRY_POLICY,
  exchangeWithRetry,
  type RetryPolicy,
} from './transient-retry.ts';
import {
  fetchTransport,
  type ModelTransport,
  type TransportReply,
} from './synthetic-transport.ts';

//region Synthetic client
// Imperative-shell client over the Synthetic API. Provider protocol failures throw;
// model-content defects (refusal-shaped replies, schema mismatches) flow as data
// because unreliable model output is an ordinary input to this pipeline. Every call
// requires an AbortSignal so user steering can always abort in-flight fan-outs, and
// requests to one model are bounded locally (provider grants 1 concurrent request
// per model per subscribed pack and queues the excess server-side; a local bound
// matching the pack count keeps queues short and aborts responsive).

/**
 * Logger root for this package's model-facing shell.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Refuses a success reply whose server-sent stream stopped before its terminator.
 *
 * MODULE SCOPE BECAUSE IT CAPTURES NOTHING. The reply handed in is its whole
 * input, so nesting it at the call site would make a closure over an empty set.
 *
 * ONLY A BODY THE STATUS ALREADY ACCEPTED. A non-success reply is reported by
 * the status branch at the call site, which names the HTTP code; reading it
 * here would replace that with a parse failure about an error page.
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
 * Builds one client over injected transport.
 * Requests to the same model flow through a local limiter whose slot count
 * matches the account's subscribed pack count;
 * different models run fully parallel, matching provider concurrency rules.
 *
 * @param apiKey - bearer token; never logged
 *
 * @param transport - HTTP seam; tests inject recorded replies
 *
 * @param chatBaseUrl - OpenAI-compatible base, overridable for tests
 *
 * @param quotasUrl - quota endpoint, overridable for tests
 *
 * @param perModelConcurrency - concurrent requests granted to each model;
 * the provider serves one request per model per subscribed pack at full
 * speed and queues the excess server-side, so match this to the pack count
 *
 * @param retryPolicy - transient-retry pacing; tests pass tiny backoffs
 *
 * @returns Client surface with chatText, chatJson, and quotas
 *
 * @example
 * ```ts
 * const client = createSyntheticClient({ apiKey: process.env['TRANSLATION_REPAIR_SYNTHETIC_API_KEY'] ?? '', },);
 * ```
 */
export function createSyntheticClient(
  {
    apiKey,
    transport = fetchTransport,
    chatBaseUrl = SYNTHETIC_CHAT_BASE_URL,
    quotasUrl = SYNTHETIC_QUOTAS_URL,
    perModelConcurrency = 1,
    retryPolicy = DEFAULT_RETRY_POLICY,
  }: {
    readonly apiKey: string;
    readonly transport?: ModelTransport;
    readonly chatBaseUrl?: string;
    readonly quotasUrl?: string;
    readonly perModelConcurrency?: number;
    readonly retryPolicy?: RetryPolicy;
  },
): SyntheticClient {
  /**
   * Per-model limiters keyed by model, created lazily;
   * bounded by catalog size.
   */
  const limiters = new Map<RosterModelId, LimitFunction>();

  /**
   * Headers shared by every exchange.
   */
  const headers: Readonly<Record<string, string>> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
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
   * const limit = limiterFor('hf:zai-org/GLM-5.2',);
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
   * Free-text chat exchange; bounded per model.
   *
   * @param request - exchange to perform
   *
   * @mutates request - `JSON.stringify` may invoke toJSON methods or getters while serializing messages and response format
   *
   * @returns Content text and usage when reported
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @throws {@link import('./completion-shape.ts').MalformedCompletionError} on contract-violating bodies
   *
   * @example
   * ```ts
   * const reply = await client.chatText({ modelId, messages, signal, },);
   * ```
   */
  function chatText(request: ForeignBorrowed<ChatTextRequest>,): Promise<ChatTextReply> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: chatText.name,
      l,
    },);

    /**
     * Message count for the entry log line.
     */
    const messageCount = request
      .messages
      .length;

    return limiterFor(request.modelId,)(async function performExchange() {
      rl.debug(
        `-> ${request.modelId}: ${String(messageCount,)} messages`,
      );

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
          label: request.modelId,
        },);

      /**
       * Signal the exchange honors: deadline-joined when armed.
       */
      const exchangeSignal = deadline === undefined
        ? request.signal
        : deadline.callSignal;

      /**
       * Messages as they go on the wire, carrying this call's own response
       * schema inside the system prompt.
       *
       * THIS PROTOCOL HAS NOWHERE ELSE TO PUT IT. The Anthropic path states the
       * schema in its own `system` field through `renderToolSystemPrompt`; an
       * OpenAI-compatible body carries only `response_format`, which a model
       * that does not honour that field never sees. `#216`.
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
       * MEASURED, NOT ESTIMATED. The gateway caps this body and reports a body
       * over the cap as a parse failure naming our JSON, so the only way to tell
       * that refusal from a real malformation is to know how big this was.
       */
      const bodyJson = JSON.stringify({
        model: request.modelId,
        messages: asked,
        // The provider is finicky without streaming, and streamed headers
        // arrive before fetch's default headers timeout can fire.
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
          url: `${chatBaseUrl}/chat/completions`,
          label: request.modelId,
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
        rl.warn(`<- ${request.modelId}: HTTP ${String(reply.status,)}`,);

        // BYTES RATHER THAN CHARACTERS, which is the whole trap here. This
        // corpus is Chinese, and one character costs three bytes in UTF-8, so a
        // `.length` here would read a third of the wire size and never once fire
        // on the case this exists for.
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
       * Content length for the completion log line.
       */
      const textLength = extracted
        .text
        .length;
      rl.debug(
        `<- ${request.modelId}: ${String(textLength,)} chars${formatUsageNote({ extracted, },)}`,
      );
      reportSpend({
        provider: 'synthetic',
        label: request.modelId,
        extracted,
      },);
      return extracted;
    },);
  }

  /**
   * Schema-validated chat exchange.
   * Content that parses and passes the guard wins even when it quotes
   * refusal-like phrasing; the refusal scan runs only on parse failure.
   *
   * THE LADDER ITSELF LIVES IN `chat-json-outcome.ts`, because none of it is
   * about this provider: it reads text a model wrote and decides whether that
   * text is an answer. The second provider runs the same steps on replies that
   * arrived over a different protocol entirely.
   *
   * @param request - exchange plus content guard
   *
   * @mutates request - `JSON.stringify` may invoke toJSON methods or getters while the delegated exchange serializes messages and response format
   *
   * @returns Outcome as data: ok, refusal-shaped, or schema-mismatch
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
   * Reads the current quota snapshot.
   *
   * @param signal - abort signal honored for the read
   *
   * @returns Typed budget-relevant quota state
   *
   * @throws {@link SyntheticHttpError} on non-success status
   *
   * @throws {@link import('./synthetic-quota.ts').QuotaShapeError} on contract-violating bodies
   *
   * @example
   * ```ts
   * const snapshot = await client.quotas({ signal, },);
   * ```
   */
  async function quotas(
    { signal, }: { readonly signal: AbortSignal; },
  ): Promise<QuotaSnapshot> {
    /**
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: quotas.name,
      l,
    },);

    /**
     * Raw reply from the quota endpoint, retried on transient statuses.
     */
    const reply = await exchangeWithRetry({
      transport,
      exchange: {
        url: quotasUrl,
        label: 'quotas',
        method: 'GET',
        headers,
        signal,
      },
      policy: retryPolicy,
    },);

    if (!isSuccessStatus({ status: reply.status, },)) {
      throw new SyntheticHttpError({
        status: reply.status,
        bodyText: reply.bodyText,
        summary: `Synthetic /quotas returned HTTP ${String(reply.status,)}:`,
      },);
    }

    /**
     * Typed snapshot parsed from the verified body shape.
     */
    const snapshot = parseQuotaSnapshot({ bodyText: reply.bodyText, },);

    /**
     * Snapshot blocks pulled out for the log line.
     */
    const {
      fiveHour,
      weekly,
    } = snapshot;
    rl.debug(
      `five-hour ${String(fiveHour.remaining,)}/${String(fiveHour.max,)}, weekly ${
        String(weekly.percentRemaining,)
      }% remaining`,
    );
    return snapshot;
  }

  return {
    chatText,
    chatJson,
    quotas,
  };
}

//endregion Synthetic client
