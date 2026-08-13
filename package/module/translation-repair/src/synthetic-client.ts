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
import { stripChannelMarker, } from './channel-marker.ts';
import { SyntheticHttpError, } from './completion-shape.ts';
import {
  formatUsageNote,
  parseModelJson,
  stripCodeFence,
  stripThinkBlock,
} from './model-content.ts';
import { detectRefusalShape, } from './refusal.ts';
import {
  SYNTHETIC_CHAT_BASE_URL,
  SYNTHETIC_QUOTAS_URL,
  type SyntheticModelId,
} from './synthetic-catalog.ts';
import { extractStreamedCompletion, } from './stream-completion.ts';
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
 * Lowest HTTP status treated as success.
 */
const HTTP_SUCCESS_MIN = 200;

/**
 * First HTTP status past the success family.
 */
const HTTP_SUCCESS_MAX_EXCLUSIVE = 300;

/**
 * Logger root for this package's model-facing shell.
 */
const l = tagged({ tag: 'translation-repair', },);

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
  const limiters = new Map<SyntheticModelId, LimitFunction>();

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
  function limiterFor(modelId: SyntheticModelId,): LimitFunction {
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
       * Raw reply from the transport seam, retried on transient statuses.
       */
      const reply = await exchangeWithRetry({
        transport,
        exchange: {
          url: `${chatBaseUrl}/chat/completions`,
          method: 'POST',
          headers,
          bodyJson: JSON.stringify({
          model: request.modelId,
          messages: request.messages,
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
          },),
          signal: exchangeSignal,
        },
        policy: retryPolicy,
      },);

      if ((reply.status < HTTP_SUCCESS_MIN) || (reply.status >= HTTP_SUCCESS_MAX_EXCLUSIVE)) {
        rl.warn(`<- ${request.modelId}: HTTP ${String(reply.status,)}`,);
        throw new SyntheticHttpError({
          status: reply.status,
          bodyText: reply.bodyText,
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
      return extracted;
    },);
  }

  /**
   * Schema-validated chat exchange.
   * Content that parses and passes the guard wins even when it quotes
   * refusal-like phrasing; the refusal scan runs only on parse failure.
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
     * Logger pre-tagged with this function's name.
     */
    const rl = tagged({
      tag: chatJson.name,
      l,
    },);

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
      ...(request.maxTokens === undefined
        ? {}
        : { maxTokens: request.maxTokens, }),
      ...(request.responseFormat === undefined
        ? {}
        : { responseFormat: request.responseFormat, }),
    },);

    /**
     * Usage spread carried onto every outcome for budget observability.
     */
    const usageSpread = reply.usage === undefined
      ? {}
      : { usage: reply.usage, };

    // The API's own refusal field outranks every content heuristic.
    if (reply.refusal !== undefined) {
      rl.debug(`${request.modelId}: refusal-shaped (api-refusal-field)`,);
      return {
        kind: 'refusal-shaped',
        rawText: reply.text === ''
          ? reply.refusal
          : reply.text,
        marker: 'api-refusal-field',
        ...usageSpread,
      };
    }

    /**
     * Answer channel with any embedded thinking block split off;
     * refusal scanning and parsing judge the answer,
     * never the deliberation (which harmlessly contains refusal-like phrasing).
     */
    const {
      answer,
      truncatedThinking,
    } = stripThinkBlock({ text: reply.text, },);

    if (truncatedThinking) {
      rl.debug(`${request.modelId}: schema-mismatch (truncated thinking)`,);
      return {
        kind: 'schema-mismatch',
        rawText: reply.text,
        detail: 'output was truncated inside its thinking block;'
          + ' raise or omit maxTokens (thinking tokens count against it)',
        ...usageSpread,
      };
    }

    /**
     * Fence-stripped answer, with any truncated channel marker removed and
     * reported. The marker is logged rather than dropped: the only reason the
     * 2026-08-13 recurrence was diagnosable is that the raw opening had been
     * recorded, and a silent strip loses that signal the next time the
     * provider's token filter changes shape.
     */
    const {
      content,
      marker,
    } = stripChannelMarker({ text: stripCodeFence({ text: answer, },), },);

    if (marker !== '')
      rl.info(`${request.modelId}: stripped channel marker ${JSON.stringify(marker,)} ahead of JSON`,);

    /**
     * Parse attempt over the unwrapped answer. The fence stripper runs a SECOND
     * time because it cannot see a fence hidden behind a marker: a reply of
     * `ep|>` then a fenced object leaves the first pass looking at the marker,
     * and without this the voice is lost to the very defect just repaired.
     */
    const attempt = parseModelJson({
      text: (marker === '') ? content : stripCodeFence({ text: content, },),
    },);

    if (!attempt.parsed) {
      /**
       * Refusal classification of the unparseable answer.
       */
      const scan = detectRefusalShape({ text: answer, },);
      if (scan.refusalShaped) {
        rl.debug(`${request.modelId}: refusal-shaped (${scan.marker})`,);
        return {
          kind: 'refusal-shaped',
          rawText: reply.text,
          marker: scan.marker,
          ...usageSpread,
        };
      }
      rl.debug(`${request.modelId}: schema-mismatch (unparseable)`,);
      return {
        kind: 'schema-mismatch',
        rawText: reply.text,
        detail: `content is not valid JSON: ${attempt.detail}`,
        ...usageSpread,
      };
    }

    /**
     * Parsed content awaiting the caller's guard.
     */
    const candidate = attempt.value;
    if (!request.validate(candidate,)) {
      rl.debug(`${request.modelId}: schema-mismatch (guard rejected)`,);
      return {
        kind: 'schema-mismatch',
        rawText: reply.text,
        detail: 'content parsed as JSON but failed the caller schema guard',
        ...usageSpread,
      };
    }

    return {
      kind: 'ok',
      value: candidate,
      rawText: reply.text,
      ...usageSpread,
    };
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
        method: 'GET',
        headers,
        signal,
      },
      policy: retryPolicy,
    },);

    if ((reply.status < HTTP_SUCCESS_MIN) || (reply.status >= HTTP_SUCCESS_MAX_EXCLUSIVE)) {
      throw new SyntheticHttpError({
        status: reply.status,
        bodyText: reply.bodyText,
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
